import type { BuyInput, HoldingLite, LotLite } from "./types";
import { qtyAdd } from "./quantity";

/**
 * Pure: append a buy lot to the holding's FIFO lot list. The new lot lands at
 * the end (preserving FIFO order — sells consume earliest lots first).
 *
 * Empty/zero-quantity buys throw; date is preserved as-is and lots are NOT
 * re-sorted (callers may insert backfill buys with an earlier date — but the
 * common path is "buy adds a lot dated today"). For backfill correctness we
 * sort by date after append; ties keep insertion order to stay deterministic.
 */
export function applyBuy(holding: HoldingLite, buy: BuyInput): HoldingLite {
  if (buy.quantity <= 0) throw new Error("buy quantity must be > 0");
  if (!Number.isFinite(buy.unitCostPaise) || buy.unitCostPaise < 0) {
    throw new Error("unitCostPaise must be a finite non-negative integer");
  }
  if (!Number.isInteger(buy.unitCostPaise)) {
    throw new Error("unitCostPaise must be integer paise");
  }
  const newLot: LotLite = {
    date: buy.date,
    quantity: buy.quantity,
    unitCostPaise: buy.unitCostPaise,
    ...(buy.txnId ? { txnId: buy.txnId } : {}),
  };
  // Insertion-stable sort by date.
  const indexed = holding.lots.map((l, i) => ({ l, i }));
  indexed.push({ l: newLot, i: indexed.length });
  indexed.sort((a, b) => {
    if (a.l.date !== b.l.date) return a.l.date.localeCompare(b.l.date);
    return a.i - b.i;
  });
  return {
    ...holding,
    quantity: qtyAdd(holding.quantity, buy.quantity),
    lots: indexed.map(({ l }) => l),
  };
}
