import { Money } from "@/lib/money";
import type { SplitChildInput, TransferInput } from "./validate";

export interface EditEntry {
  at: string;
  field: string;
  from: unknown;
  to: unknown;
}

function deepEq(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function applyEditHistory<T extends Record<string, unknown>>(
  prev: T,
  patch: Partial<T>,
  nowIso: string,
): { next: T; entries: EditEntry[] } {
  const entries: EditEntry[] = [];
  const next: T = { ...prev };
  for (const key of Object.keys(patch)) {
    const value = (patch as Record<string, unknown>)[key];
    if (value === undefined) continue;
    const prevVal = (prev as Record<string, unknown>)[key];
    if (deepEq(prevVal, value)) continue;
    entries.push({ at: nowIso, field: key, from: prevVal, to: value });
    (next as Record<string, unknown>)[key] = value;
  }
  return { next, entries };
}

export function markSoftDeleted<T extends Record<string, unknown>>(
  txn: T,
  nowIso: string,
): { next: T; entries: EditEntry[] } {
  return applyEditHistory(
    txn,
    { isDeleted: true, deletedAt: nowIso } as unknown as Partial<T>,
    nowIso,
  );
}

export interface ParentLike {
  _id: string;
  amountPaise: number;
  direction: "in" | "out";
  accountId: string;
  valueDate: string;
  bookedAt: string;
  receivableId?: string;
  splitId?: string;
  isDeleted?: boolean;
}

export interface ChildToInsert {
  parentTransactionId: string;
  accountId: string;
  amountPaise: number;
  direction: "in" | "out";
  flowType: SplitChildInput["flowType"];
  needWant?: SplitChildInput["needWant"];
  categoryId?: string;
  counterpartyId?: string;
  description: string;
  notes?: string;
  valueDate: string;
  bookedAt: string;
  source: "split_child";
  reviewStatus: "confirmed";
}

export interface BuildSplitResult {
  errors: string[];
  children: ChildToInsert[];
}

export function buildSplitChildren(
  parent: ParentLike,
  childInputs: SplitChildInput[],
  hasLiveChildren: boolean,
  nowIso: string,
): BuildSplitResult {
  const errors: string[] = [];
  if (parent.isDeleted) errors.push("parent is soft-deleted");
  if (hasLiveChildren) errors.push("parent already has live children — cannot re-split");
  if (parent.receivableId) errors.push("parent is linked to a receivable — split blocked");
  if (parent.splitId) errors.push("parent is part of a SplitBill — split blocked");

  const sum = childInputs.reduce(
    (acc, c) => acc.add(Money.fromPaise(c.amountPaise)),
    Money.zero(),
  );
  if (!sum.eq(Money.fromPaise(parent.amountPaise))) {
    errors.push(
      `children sum (${sum.paise} paise) must equal parent amount (${parent.amountPaise} paise)`,
    );
  }
  if (errors.length > 0) return { errors, children: [] };

  const children: ChildToInsert[] = childInputs.map((c) => ({
    parentTransactionId: parent._id,
    accountId: parent.accountId,
    amountPaise: c.amountPaise,
    direction: parent.direction,
    flowType: c.flowType,
    ...(c.needWant ? { needWant: c.needWant } : {}),
    ...(c.categoryId ? { categoryId: c.categoryId } : {}),
    ...(c.counterpartyId ? { counterpartyId: c.counterpartyId } : {}),
    description: c.description ?? "",
    ...(c.notes ? { notes: c.notes } : {}),
    valueDate: parent.valueDate,
    bookedAt: nowIso,
    source: "split_child" as const,
    reviewStatus: "confirmed" as const,
  }));
  return { errors: [], children };
}

export interface TransferLeg {
  accountId: string;
  amountPaise: number;
  direction: "in" | "out";
  flowType: "transfer";
  valueDate: string;
  bookedAt: string;
  description: string;
  notes?: string;
  source: "manual";
  reviewStatus: "confirmed";
  reimbursesTransactionId?: string;
}

export function buildTransferLegs(
  input: TransferInput,
  nowIso: string,
): { legA: TransferLeg; legB: TransferLeg } {
  const bookedAt = input.bookedAt ?? nowIso;
  const desc = input.description ?? "";
  const legA: TransferLeg = {
    accountId: input.fromAccountId,
    amountPaise: input.amountPaise,
    direction: "out",
    flowType: "transfer",
    valueDate: input.valueDate,
    bookedAt,
    description: desc,
    ...(input.notes ? { notes: input.notes } : {}),
    source: "manual",
    reviewStatus: "confirmed",
  };
  const legB: TransferLeg = {
    accountId: input.toAccountId,
    amountPaise: input.amountPaise,
    direction: "in",
    flowType: "transfer",
    valueDate: input.valueDate,
    bookedAt,
    description: desc,
    ...(input.notes ? { notes: input.notes } : {}),
    source: "manual",
    reviewStatus: "confirmed",
  };
  return { legA, legB };
}
