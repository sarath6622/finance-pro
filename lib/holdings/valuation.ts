import type {
  HoldingLite,
  HoldingValuation,
  PortfolioBucket,
  PortfolioSnapshot,
  ValuationInput,
} from "./types";
import { qtyTimesPaise, toMicroUnits } from "./quantity";

const DEFAULT_STALE_AFTER_SEC = 24 * 3600;

/** Cost basis (paise) = Σ lots.qty × lots.unitCost, paise-rounded per lot. */
export function costBasisPaise(holding: HoldingLite): number {
  let total = 0;
  for (const lot of holding.lots) {
    total += qtyTimesPaise(lot.quantity, lot.unitCostPaise);
  }
  return total;
}

/**
 * Resolve the unit price in INR-paise:
 *   - explicit override wins
 *   - else holding.currentUnitPricePaise (INR if priceCurrency=INR)
 *   - else if priceCurrency=USD, multiply by fxRateToInr (paise/USD-paise effectively;
 *     we treat fxRate as INR per 1 USD-paise, applied at integer math)
 */
function resolveUnitPriceInrPaise(
  holding: HoldingLite,
  input: ValuationInput,
): number | undefined {
  if (input.pricePaise !== undefined) return input.pricePaise;
  if (holding.currentUnitPricePaise === undefined) return undefined;
  if (holding.priceCurrency === "INR") {
    return holding.currentUnitPricePaise;
  }
  // USD-priced: convert via FX rate.
  const fx = input.fxRateToInr ?? holding.fxRateToInr;
  if (!fx || fx <= 0) return undefined;
  // currentUnitPricePaise is USD-paise (cents × 100? we treat it as
  // USD-base-unit × 100, mirroring the INR-paise convention but in USD).
  // Total INR = USD × fxRate → paise; we round.
  return Math.round(holding.currentUnitPricePaise * fx);
}

function isStale(
  priceUpdatedAt: string | undefined,
  asOf: string | undefined,
  staleAfterSec: number,
): boolean {
  if (!priceUpdatedAt) return true;
  const now = asOf ? new Date(asOf).getTime() : Date.now();
  const then = new Date(priceUpdatedAt).getTime();
  if (Number.isNaN(then)) return true;
  return (now - then) / 1000 > staleAfterSec;
}

export function valueAt(holding: HoldingLite, input: ValuationInput = {}): HoldingValuation {
  const cost = costBasisPaise(holding);
  const unitPrice = resolveUnitPriceInrPaise(holding, input);
  const stale = isStale(
    holding.priceUpdatedAt,
    input.asOf,
    input.staleAfterSec ?? DEFAULT_STALE_AFTER_SEC,
  );
  let market = 0;
  let unrealized = 0;
  let isPartial = false;
  if (unitPrice === undefined) {
    isPartial = true;
    // Fall back to cost basis so we don't show ₹0; the UI flags this state.
    market = cost;
    unrealized = 0;
  } else {
    market = qtyTimesPaise(holding.quantity, unitPrice);
    unrealized = market - cost;
  }
  return {
    holdingId: holding._id,
    quantity: holding.quantity,
    unitPriceInrPaise: unitPrice ?? 0,
    marketValuePaise: market,
    costBasisPaise: cost,
    unrealizedPnLPaise: unrealized,
    realizedPnLPaise: holding.realizedPnLPaise,
    ...(holding.priceUpdatedAt ? { priceUpdatedAt: holding.priceUpdatedAt } : {}),
    isStalePrice: stale,
    isInvestmentPartial: isPartial,
  };
}

/**
 * Bucket a set of holding valuations by a key (assetType or platform). Empty
 * buckets are omitted; pct is computed across the total market value.
 */
function bucket<H extends HoldingLite>(
  holdings: H[],
  valuations: HoldingValuation[],
  keyFn: (h: H) => string,
  totalMarket: number,
): PortfolioBucket[] {
  const acc = new Map<
    string,
    { marketValuePaise: number; costBasisPaise: number; unrealizedPnLPaise: number; holdingCount: number }
  >();
  for (let i = 0; i < holdings.length; i++) {
    const h = holdings[i]!;
    const v = valuations[i]!;
    const key = keyFn(h);
    const cur = acc.get(key) ?? {
      marketValuePaise: 0,
      costBasisPaise: 0,
      unrealizedPnLPaise: 0,
      holdingCount: 0,
    };
    cur.marketValuePaise += v.marketValuePaise;
    cur.costBasisPaise += v.costBasisPaise;
    cur.unrealizedPnLPaise += v.unrealizedPnLPaise;
    cur.holdingCount += 1;
    acc.set(key, cur);
  }
  return [...acc.entries()]
    .map(([key, b]) => ({
      key,
      ...b,
      // eslint-disable-next-line no-restricted-syntax -- ratio (0..1), not money math
      pct: totalMarket > 0 ? b.marketValuePaise / totalMarket : 0,
    }))
    .sort((a, b) => b.marketValuePaise - a.marketValuePaise);
}

/**
 * Build the full portfolio snapshot from a set of holdings + a ValuationInput
 * applied to each. Asset-type and platform allocations sum to (close to) 100%.
 */
export function buildPortfolioSnapshot(
  holdings: HoldingLite[],
  input: ValuationInput = {},
): PortfolioSnapshot {
  const live = holdings.filter((h) => h.isActive && toMicroUnits(h.quantity) > 0);
  const valuations = live.map((h) => valueAt(h, input));
  const totalMarket = valuations.reduce((s, v) => s + v.marketValuePaise, 0);
  const totalCost = valuations.reduce((s, v) => s + v.costBasisPaise, 0);
  const totalUnrealized = totalMarket - totalCost;
  const totalRealized = live.reduce((s, h) => s + h.realizedPnLPaise, 0);
  const stalePriceCount = valuations.filter((v) => v.isStalePrice && !v.isInvestmentPartial).length;
  return {
    asOf: input.asOf ?? new Date().toISOString(),
    totals: {
      marketValuePaise: totalMarket,
      costBasisPaise: totalCost,
      unrealizedPnLPaise: totalUnrealized,
      realizedPnLPaise: totalRealized,
      holdingCount: live.length,
      stalePriceCount,
    },
    byAssetType: bucket(live, valuations, (h) => h.assetType, totalMarket),
    byPlatform: bucket(live, valuations, (h) => h.platform, totalMarket),
    holdings: valuations,
  };
}
