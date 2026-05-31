import { Types } from "mongoose";
import { AccountModel, TransactionModel } from "@/models";
import { conflict, notFound, validation } from "@/lib/http/errors";
import { splitEmiPayment } from "@/lib/projection/amortization";
import { loanOutstandingAt } from "@/lib/projection/loan-balance";
import type { TxnLite } from "@/lib/balances/types";

interface CreateDebtRepaymentInput {
  valueDate: string;
  bookedAt?: string;
  amountPaise: number;
  accountId: string; // payer (asset) account
  debtAccountId: string; // the loan being paid down
  counterpartyId?: string;
  categoryId?: string;
  description?: string;
  notes?: string;
  recurringRuleId?: string;
  reviewStatus?: "confirmed" | "needs_review";
  source?: "manual" | "import" | "recurring" | "split_child";
  /** Optional explicit interest override; if omitted, computed from current outstanding × rate/12. */
  interestPortionPaise?: number;
}

/**
 * Create an EMI/debt_repayment transaction with the principal/interest split
 * pre-computed. The loan account's outstanding is derived from txns + opening
 * balance, so we don't mutate any "balance" field — we just attach the split
 * to the txn so reports can surface interest separately.
 */
export async function createDebtRepayment(input: CreateDebtRepaymentInput): Promise<{
  transactionId: string;
  interestPortionPaise: number;
  principalPortionPaise: number;
  outstandingBeforePaise: number;
  outstandingAfterPaise: number;
}> {
  if (input.amountPaise <= 0) throw validation("amountPaise must be > 0");

  const loan = await AccountModel.findById(input.debtAccountId).lean();
  if (!loan) throw notFound("debt account not found");
  if (loan.kind !== "loan") {
    throw validation(`debtAccountId must reference a 'loan' kind account (got ${loan.kind})`);
  }
  if (loan.classification !== "liability") {
    throw validation("debt account must be classified as 'liability'");
  }
  const ratePA = loan.interestRatePA ?? 0;

  // Compute current outstanding before this payment.
  const liveTxns = await TransactionModel.find(
    { debtAccountId: input.debtAccountId, isDeleted: false },
    { _id: 1, amountPaise: 1, interestPortionPaise: 1, flowType: 1, debtAccountId: 1, isDeleted: 1, valueDate: 1, accountId: 1, direction: 1 },
  ).lean();
  const lite: TxnLite[] = liveTxns.map((t) => ({
    _id: String(t._id),
    accountId: String(t.accountId),
    valueDate: t.valueDate,
    flowType: t.flowType as TxnLite["flowType"],
    direction: t.direction as TxnLite["direction"],
    amountPaise: t.amountPaise,
    isDeleted: false,
    debtAccountId: String(loan._id),
    ...(t.interestPortionPaise !== undefined && t.interestPortionPaise !== null
      ? { interestPortionPaise: t.interestPortionPaise }
      : {}),
  }));
  const loanLite = {
    _id: String(loan._id),
    openingBalancePaise: loan.openingBalancePaise,
    ...(loan.interestRatePA !== undefined && loan.interestRatePA !== null
      ? { interestRatePA: loan.interestRatePA }
      : {}),
    ...(loan.emiAmountPaise !== undefined && loan.emiAmountPaise !== null
      ? { emiPaise: loan.emiAmountPaise }
      : {}),
  };
  const outstandingBefore = loanOutstandingAt(loanLite, lite);
  if (outstandingBefore <= 0) {
    throw conflict("Loan is already paid off — no further debt_repayment allowed");
  }

  // Cap payment at outstanding + this month's accrued interest so we never go negative.
  const monthlyAccrued = Math.round((outstandingBefore * ratePA) / 100 / 12);
  const maxPayment = outstandingBefore + monthlyAccrued;
  if (input.amountPaise > maxPayment + 100) {
    throw conflict(
      `Payment ${input.amountPaise} paise exceeds outstanding+accrued (${maxPayment}). Reduce amount.`,
    );
  }

  let interestPortion: number;
  let principalPortion: number;
  if (input.interestPortionPaise !== undefined) {
    if (input.interestPortionPaise < 0 || input.interestPortionPaise > input.amountPaise) {
      throw validation("interestPortionPaise must be between 0 and amountPaise");
    }
    interestPortion = input.interestPortionPaise;
    principalPortion = input.amountPaise - interestPortion;
  } else {
    const split = splitEmiPayment(input.amountPaise, outstandingBefore, ratePA);
    interestPortion = split.interestPaise;
    principalPortion = split.principalPaise;
  }
  // Don't pay more principal than is left.
  if (principalPortion > outstandingBefore) {
    principalPortion = outstandingBefore;
    interestPortion = input.amountPaise - principalPortion;
  }

  const txn = await TransactionModel.create({
    valueDate: input.valueDate,
    bookedAt: input.bookedAt ? new Date(input.bookedAt) : new Date(),
    amountPaise: input.amountPaise,
    direction: "out",
    flowType: "debt_repayment",
    accountId: input.accountId,
    debtAccountId: new Types.ObjectId(input.debtAccountId),
    interestPortionPaise: interestPortion,
    ...(input.counterpartyId ? { counterpartyId: input.counterpartyId } : {}),
    ...(input.categoryId ? { categoryId: input.categoryId } : {}),
    ...(input.recurringRuleId ? { recurringRuleId: input.recurringRuleId } : {}),
    description: input.description ?? "",
    ...(input.notes ? { notes: input.notes } : {}),
    source: input.source ?? "manual",
    reviewStatus: input.reviewStatus ?? "confirmed",
    isDeleted: false,
    editHistory: [],
  });

  return {
    transactionId: String(txn._id),
    interestPortionPaise: interestPortion,
    principalPortionPaise: principalPortion,
    outstandingBeforePaise: outstandingBefore,
    outstandingAfterPaise: outstandingBefore - principalPortion,
  };
}

/**
 * Pure helper for the card-in-full guard. Used by POST /api/transactions when
 * flowType=card_settlement, returning a warning rather than blocking unless
 * the caller opts out.
 */
export interface CardInFullCheck {
  shortfallPaise: number;
  cardBalancePaise: number;
  paymentPaise: number;
  isFull: boolean;
}

export function cardInFullCheck(
  cardBalancePaise: number,
  paymentPaise: number,
): CardInFullCheck {
  const shortfall = Math.max(0, cardBalancePaise - paymentPaise);
  return {
    shortfallPaise: shortfall,
    cardBalancePaise,
    paymentPaise,
    isFull: shortfall === 0,
  };
}
