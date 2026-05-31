import type { TxnLite } from "@/lib/balances/types";

export interface LoanAccountLite {
  _id: string;
  openingBalancePaise: number;
  interestRatePA?: number;
  emiPaise?: number;
}

/**
 * Loan-account outstanding is derived purely from `debt_repayment` transactions
 * that link to it via `debtAccountId`. Each such transaction reduces the
 * outstanding by its *principal* portion: `amountPaise - interestPortionPaise`.
 * Interest portion accrues elsewhere (cost reports) and never touches the
 * liability balance.
 *
 * Soft-deleted txns are excluded by callers via the existing isDeleted filter
 * (we accept them here so the function stays a pure single-pass reduce).
 */
export function loanOutstandingAt(
  loan: LoanAccountLite,
  txns: TxnLite[],
  cutoff?: string,
): number {
  let outstanding = loan.openingBalancePaise;
  for (const t of txns) {
    if (t.isDeleted) continue;
    if (t.flowType !== "debt_repayment") continue;
    if (t.debtAccountId !== loan._id) continue;
    if (cutoff && t.valueDate > cutoff) continue;
    const interest = t.interestPortionPaise ?? 0;
    const principal = Math.max(0, t.amountPaise - interest);
    outstanding -= principal;
  }
  return Math.max(0, outstanding);
}

export interface LoanInterestTotals {
  interestPaise: number;
  principalPaise: number;
  paymentPaise: number;
  txnCount: number;
}

/**
 * Sum interest / principal / payments for a loan account inside [from, to]
 * (both inclusive). Used by R11 and the "this month's interest cost" tile.
 */
export function loanInterestTotalsInRange(
  loan: LoanAccountLite,
  txns: TxnLite[],
  from: string,
  to: string,
): LoanInterestTotals {
  let interest = 0;
  let principal = 0;
  let payment = 0;
  let count = 0;
  for (const t of txns) {
    if (t.isDeleted) continue;
    if (t.flowType !== "debt_repayment") continue;
    if (t.debtAccountId !== loan._id) continue;
    if (t.valueDate < from || t.valueDate > to) continue;
    const i = t.interestPortionPaise ?? 0;
    interest += i;
    principal += Math.max(0, t.amountPaise - i);
    payment += t.amountPaise;
    count += 1;
  }
  return { interestPaise: interest, principalPaise: principal, paymentPaise: payment, txnCount: count };
}
