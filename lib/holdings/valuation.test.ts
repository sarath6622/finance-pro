import { describe, expect, it } from "vitest";
import { applyBuy } from "./apply-buy";
import { buildPortfolioSnapshot, costBasisPaise, valueAt } from "./valuation";
import type { HoldingLite } from "./types";

function fresh(overrides: Partial<HoldingLite> = {}): HoldingLite {
  return {
    _id: "h1",
    assetType: "crypto",
    symbol: "BTC",
    name: "Bitcoin",
    platform: "CoinDCX",
    quantity: 0,
    lots: [],
    priceCurrency: "INR",
    priceSource: "manual",
    realizedPnLPaise: 0,
    isActive: true,
    ...overrides,
  };
}

describe("costBasisPaise", () => {
  it("sums paise across lots", () => {
    let h = fresh();
    h = applyBuy(h, { date: "2026-01-01", quantity: 1, unitCostPaise: 100 });
    h = applyBuy(h, { date: "2026-02-01", quantity: 0.5, unitCostPaise: 200 });
    // 1×100 + 0.5×200 = 200 paise
    expect(costBasisPaise(h)).toBe(200);
  });
});

describe("valueAt — INR-priced holding", () => {
  it("marketValue = qty × currentUnitPricePaise; unrealized = market − cost", () => {
    let h = fresh({ currentUnitPricePaise: 200_000_000, priceUpdatedAt: new Date().toISOString() });
    h = applyBuy(h, { date: "2026-01-01", quantity: 0.5, unitCostPaise: 100_000_000 });
    const v = valueAt(h);
    expect(v.marketValuePaise).toBe(100_000_000); // 0.5 × ₹20L
    expect(v.costBasisPaise).toBe(50_000_000); // 0.5 × ₹10L
    expect(v.unrealizedPnLPaise).toBe(50_000_000);
    expect(v.isStalePrice).toBe(false);
    expect(v.isInvestmentPartial).toBe(false);
  });

  it("falls back to cost basis + flags partial when no price known", () => {
    let h = fresh();
    h = applyBuy(h, { date: "2026-01-01", quantity: 0.5, unitCostPaise: 100_000_000 });
    const v = valueAt(h);
    expect(v.marketValuePaise).toBe(50_000_000);
    expect(v.unrealizedPnLPaise).toBe(0);
    expect(v.isInvestmentPartial).toBe(true);
    expect(v.isStalePrice).toBe(true);
  });

  it("flags stale prices (default 24h window)", () => {
    const old = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
    let h = fresh({ currentUnitPricePaise: 100, priceUpdatedAt: old });
    h = applyBuy(h, { date: "2026-01-01", quantity: 1, unitCostPaise: 100 });
    expect(valueAt(h).isStalePrice).toBe(true);
  });
});

describe("valueAt — USD-priced holding (E31)", () => {
  it("converts USD price to INR via fxRateToInr", () => {
    let h = fresh({
      priceCurrency: "USD",
      currentUnitPricePaise: 5_000_000_000, // 50,000 USD-paise (₹500 USD-equivalent × 100)
      // We treat currentUnitPricePaise as USD-base-unit × 100 (cents-style),
      // and fxRateToInr as INR per 1 USD-base-unit.
      fxRateToInr: 83,
      priceUpdatedAt: new Date().toISOString(),
    });
    h = applyBuy(h, { date: "2026-01-01", quantity: 0.1, unitCostPaise: 100_000_000 });
    const v = valueAt(h);
    // unitPriceInr = 5_000_000_000 × 83 = 415_000_000_000
    // marketValue = 0.1 × 415_000_000_000 = 41_500_000_000 paise
    expect(v.unitPriceInrPaise).toBe(415_000_000_000);
    expect(v.marketValuePaise).toBe(41_500_000_000);
  });

  it("falls back to partial when USD set but fxRate missing", () => {
    const h = fresh({
      priceCurrency: "USD",
      currentUnitPricePaise: 100,
      // no fxRateToInr
      priceUpdatedAt: new Date().toISOString(),
    });
    const v = valueAt(h);
    expect(v.isInvestmentPartial).toBe(true);
  });
});

describe("buildPortfolioSnapshot — R20/R21/R22", () => {
  it("aggregates totals, asset-type allocation, platform allocation", () => {
    const btc = fresh({
      _id: "h-btc",
      assetType: "crypto",
      platform: "CoinDCX",
      currentUnitPricePaise: 200_000_000,
      priceUpdatedAt: new Date().toISOString(),
    });
    const tcs = fresh({
      _id: "h-tcs",
      assetType: "stock",
      symbol: "TCS",
      name: "TCS",
      platform: "Zerodha",
      currentUnitPricePaise: 300000,
      priceUpdatedAt: new Date().toISOString(),
    });
    const btcF = applyBuy(btc, { date: "2026-01-01", quantity: 0.5, unitCostPaise: 100_000_000 });
    const tcsF = applyBuy(tcs, { date: "2026-01-01", quantity: 100, unitCostPaise: 200000 });
    const snap = buildPortfolioSnapshot([btcF, tcsF]);
    // BTC: 0.5 × 200_000_000 = 100_000_000; TCS: 100 × 300000 = 30_000_000
    expect(snap.totals.marketValuePaise).toBe(100_000_000 + 30_000_000);
    expect(snap.totals.costBasisPaise).toBe(50_000_000 + 20_000_000);
    expect(snap.totals.unrealizedPnLPaise).toBe(60_000_000);
    expect(snap.totals.holdingCount).toBe(2);
    expect(snap.byAssetType.find((b) => b.key === "crypto")!.marketValuePaise).toBe(100_000_000);
    expect(snap.byAssetType.find((b) => b.key === "stock")!.marketValuePaise).toBe(30_000_000);
    // pct sums to ~1
    expect(
      snap.byAssetType.reduce((s, b) => s + b.pct, 0),
    ).toBeCloseTo(1, 8);
  });

  it("filters out inactive / zero-qty holdings", () => {
    const empty = fresh({ _id: "h-empty", quantity: 0 });
    const inactive = fresh({ _id: "h-x", isActive: false, quantity: 1 });
    const snap = buildPortfolioSnapshot([empty, inactive]);
    expect(snap.totals.holdingCount).toBe(0);
  });
});
