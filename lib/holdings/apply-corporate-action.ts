import type { CorporateActionInput, HoldingLite, LotLite } from "./types";
import { paiseDivideRatio, qtyTimesRatio, toMicroUnits } from "./quantity";

export class CorporateActionError extends Error {
  constructor(public code: "invalid_ratio" | "wrong_asset_type") {
    super(code);
    this.name = "CorporateActionError";
  }
}

/**
 * Pure: apply a stock split / bonus issue.
 *
 *   - 2:1 split → ratio (num=2, den=1) → qty × 2, unitCost ÷ 2 (total basis intact)
 *   - 1:1 bonus → ratio (num=2, den=1) too (bonus = same math as split for basis preservation)
 *   - 3:2 stock split → num=3, den=2 → qty × 1.5, unitCost ÷ 1.5
 *
 * Crypto/MF: bonus / split is rare; we allow it but the typical path is stocks.
 *
 * **No P&L event** — total cost basis is conserved (E32).
 */
export function applyCorporateAction(
  holding: HoldingLite,
  action: CorporateActionInput,
): HoldingLite {
  if (action.ratioNumerator <= 0 || action.ratioDenominator <= 0) {
    throw new CorporateActionError("invalid_ratio");
  }
  if (action.ratioNumerator === action.ratioDenominator) {
    // No-op ratio; return as-is.
    return holding;
  }

  const newLots: LotLite[] = holding.lots.map((lot) => ({
    ...lot,
    quantity: qtyTimesRatio(lot.quantity, action.ratioNumerator, action.ratioDenominator),
    unitCostPaise: paiseDivideRatio(
      lot.unitCostPaise,
      action.ratioNumerator,
      action.ratioDenominator,
    ),
  }));
  // Total quantity recomputed from lots (avoids accumulating rounding error).
  const totalMicro = newLots.reduce((s, l) => s + toMicroUnits(l.quantity), 0);
  return {
    ...holding,
    quantity: totalMicro / 1e8,
    lots: newLots,
    // realizedPnL untouched
  };
}
