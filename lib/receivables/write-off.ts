import { computeOutstanding } from "./apply-repayment";
import type { ReceivableLite, ReceivableNext, RepaymentLite } from "./types";

export interface WriteOffOptions {
  categoryId?: string;
  notes?: string;
}

export interface CompensatingTxnDraft {
  flowType: "spend";
  direction: "out";
  amountPaise: number;
  valueDate: string;
  bookedAt: string;
  accountId: string;
  counterpartyId: string;
  categoryId?: string;
  description: string;
  notes?: string;
  receivableId: string;
  source: "manual";
  reviewStatus: "confirmed";
  needWant: "want";
}

export interface WriteOffResult {
  receivableNext: ReceivableNext;
  compensatingTxnDraft: CompensatingTxnDraft;
}

export class WriteOffError extends Error {
  constructor(public readonly code: "nothing_outstanding" | "already_written_off" | "missing_account") {
    super(code);
    this.name = "WriteOffError";
  }
}

export function writeOff(
  rec: ReceivableLite,
  repayments: RepaymentLite[],
  asOf: string,
  nowIso: string,
  options: WriteOffOptions = {},
): WriteOffResult {
  if (rec.status === "written_off") throw new WriteOffError("already_written_off");
  if (!rec.accountId) throw new WriteOffError("missing_account");
  const { outstandingPaise } = computeOutstanding(rec, repayments);
  if (outstandingPaise === 0) throw new WriteOffError("nothing_outstanding");

  const receivableNext: ReceivableNext = {
    status: "written_off",
    closedAt: nowIso,
    repaymentTxnIds: rec.repaymentTxnIds,
    outstandingPaise: 0,
    overpaymentPaise: 0,
  };
  const compensatingTxnDraft: CompensatingTxnDraft = {
    flowType: "spend",
    direction: "out",
    amountPaise: outstandingPaise,
    valueDate: asOf.slice(0, 10),
    bookedAt: nowIso,
    accountId: rec.accountId,
    counterpartyId: rec.counterpartyId,
    ...(options.categoryId ? { categoryId: options.categoryId } : {}),
    description: "Write-off (gift)",
    ...(options.notes ? { notes: options.notes } : {}),
    receivableId: rec._id,
    source: "manual",
    reviewStatus: "confirmed",
    needWant: "want",
  };
  return { receivableNext, compensatingTxnDraft };
}
