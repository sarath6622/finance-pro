import type { TxnLite } from "./types";

export function isActiveTxn(txn: TxnLite): boolean {
  return !txn.isDeleted;
}

export function liveChildrenByParent(txns: TxnLite[]): Map<string, TxnLite[]> {
  const out = new Map<string, TxnLite[]>();
  for (const t of txns) {
    if (t.isDeleted) continue;
    if (!t.parentTransactionId) continue;
    const list = out.get(t.parentTransactionId) ?? [];
    list.push(t);
    out.set(t.parentTransactionId, list);
  }
  return out;
}

export function isSplitParentContainer(
  txn: TxnLite,
  childrenByParent: Map<string, TxnLite[]>,
): boolean {
  const kids = childrenByParent.get(txn._id);
  return !!kids && kids.length > 0;
}

export function isWithinCutoff(txn: TxnLite, cutoff?: string): boolean {
  if (!cutoff) return true;
  return txn.valueDate <= cutoff;
}

export function isOnOrAfterOpening(txn: TxnLite, openingDate?: string): boolean {
  if (!openingDate) return true;
  return txn.valueDate >= openingDate.slice(0, 10);
}
