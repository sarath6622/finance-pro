import type { ReceivableLite, ReceivableNext, RepaymentLite } from "./types";

export interface OutstandingResult {
  outstandingPaise: number;
  overpaymentPaise: number;
}

export function computeOutstanding(
  rec: ReceivableLite,
  repayments: RepaymentLite[],
): OutstandingResult {
  let paid = 0;
  for (const r of repayments) {
    if (r.isDeleted) continue;
    paid += r.amountPaise;
  }
  const outstandingPaise = Math.max(rec.principalPaise - paid, 0);
  const overpaymentPaise = Math.max(paid - rec.principalPaise, 0);
  return { outstandingPaise, overpaymentPaise };
}

export class ReceivableWriteOffError extends Error {
  constructor() {
    super("Cannot apply repayment to a written_off receivable");
    this.name = "ReceivableWriteOffError";
  }
}

export function applyRepayment(
  rec: ReceivableLite,
  newRepayment: RepaymentLite,
  liveRepayments: RepaymentLite[],
  nowIso: string,
): ReceivableNext {
  if (rec.status === "written_off") throw new ReceivableWriteOffError();
  if (newRepayment.amountPaise <= 0) {
    throw new Error("repayment amount must be > 0");
  }

  const all = liveRepayments.filter((r) => r._id !== newRepayment._id);
  all.push(newRepayment);

  const { outstandingPaise, overpaymentPaise } = computeOutstanding(rec, all);
  const ids = new Set(rec.repaymentTxnIds);
  ids.add(newRepayment._id);
  const repaymentTxnIds = [...ids];

  if (outstandingPaise === 0) {
    return {
      status: "closed",
      closedAt: nowIso,
      repaymentTxnIds,
      outstandingPaise: 0,
      overpaymentPaise,
    };
  }
  return {
    status: "partial",
    repaymentTxnIds,
    outstandingPaise,
    overpaymentPaise: 0,
  };
}

export function recomputeReceivableState(
  rec: ReceivableLite,
  liveRepayments: RepaymentLite[],
  nowIso: string,
): ReceivableNext {
  if (rec.status === "written_off") {
    return {
      status: "written_off",
      ...(rec.closedAt ? { closedAt: rec.closedAt } : {}),
      repaymentTxnIds: rec.repaymentTxnIds,
      outstandingPaise: 0,
      overpaymentPaise: 0,
    };
  }
  const { outstandingPaise, overpaymentPaise } = computeOutstanding(rec, liveRepayments);
  const repaymentTxnIds = liveRepayments.map((r) => r._id);
  if (liveRepayments.length === 0) {
    return {
      status: "open",
      repaymentTxnIds: [],
      outstandingPaise: rec.principalPaise,
      overpaymentPaise: 0,
    };
  }
  if (outstandingPaise === 0) {
    return {
      status: "closed",
      closedAt: rec.closedAt ?? nowIso,
      repaymentTxnIds,
      outstandingPaise: 0,
      overpaymentPaise,
    };
  }
  return {
    status: "partial",
    repaymentTxnIds,
    outstandingPaise,
    overpaymentPaise: 0,
  };
}
