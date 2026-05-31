export type AssetType = "crypto" | "stock" | "mutual_fund";
export type PriceCurrency = "INR" | "USD";
export type PriceSource = "manual" | "auto";

export interface LotLite {
  date: string; // YYYY-MM-DD
  quantity: number; // up to 8 dp for crypto, integer for stocks
  unitCostPaise: number;
  txnId?: string;
}

export interface CorporateActionLog {
  at: string; // ISO datetime
  kind: "split" | "bonus";
  ratioNumerator: number;
  ratioDenominator: number;
  notes?: string;
}

export interface HoldingLite {
  _id: string;
  assetType: AssetType;
  symbol: string;
  name: string;
  platform: string;
  quantity: number;
  lots: LotLite[];
  currentUnitPricePaise?: number;
  priceCurrency: PriceCurrency;
  fxRateToInr?: number;
  fxRateAt?: string;
  priceUpdatedAt?: string;
  priceSource: PriceSource;
  realizedPnLPaise: number;
  isActive: boolean;
}

export interface BuyInput {
  date: string;
  quantity: number;
  unitCostPaise: number;
  txnId?: string;
}

export interface SellInput {
  date: string;
  quantity: number;
  unitPricePaise: number;
  txnId?: string;
}

export interface LotConsumption {
  lotIndex: number;
  lotDate: string;
  qtyConsumed: number;
  costBasisPaise: number; // qty * unitCost
  proceedsPaise: number; // qty * unitSell
  realizedPnLPaise: number;
}

export interface SellResult {
  holding: HoldingLite;
  consumed: LotConsumption[];
  realizedPnLPaise: number;
  totalProceedsPaise: number;
}

export interface CorporateActionInput {
  kind: "split" | "bonus";
  ratioNumerator: number; // e.g. 2 for 2:1 split (new=2x)
  ratioDenominator: number; // e.g. 1
  at?: string;
  notes?: string;
}

export interface TransferInput {
  date: string;
  quantity: number;
  toPlatform: string;
}

export interface ValuationInput {
  /** Override price (paise per unit, in INR-equivalent). If absent, uses holding.currentUnitPricePaise + fx. */
  pricePaise?: number;
  /** Override fxRate (INR per USD). If absent, uses holding.fxRateToInr. */
  fxRateToInr?: number;
  /** "now" — typically server clock. ISO datetime. Used to compute isStalePrice. */
  asOf?: string;
  /** Max age in seconds for a price to count as fresh; default 24h. */
  staleAfterSec?: number;
}

export interface HoldingValuation {
  holdingId: string;
  quantity: number;
  unitPriceInrPaise: number;
  marketValuePaise: number;
  costBasisPaise: number;
  unrealizedPnLPaise: number;
  realizedPnLPaise: number;
  priceUpdatedAt?: string;
  isStalePrice: boolean;
  isInvestmentPartial: boolean; // true if no price known
}

export interface PortfolioBucket {
  key: string;
  marketValuePaise: number;
  costBasisPaise: number;
  unrealizedPnLPaise: number;
  pct: number; // 0..1 of total
  holdingCount: number;
}

export interface PortfolioSnapshot {
  asOf: string;
  totals: {
    marketValuePaise: number;
    costBasisPaise: number;
    unrealizedPnLPaise: number;
    realizedPnLPaise: number;
    holdingCount: number;
    stalePriceCount: number;
  };
  byAssetType: PortfolioBucket[];
  byPlatform: PortfolioBucket[];
  holdings: HoldingValuation[];
}
