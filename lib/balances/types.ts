import type {
  AccountClassification,
  FlowType,
  TxnDirection,
} from "@/lib/schemas/common";

export interface TxnLite {
  _id: string;
  accountId: string;
  valueDate: string;
  flowType: FlowType;
  direction: TxnDirection;
  amountPaise: number;
  isDeleted: boolean;
  parentTransactionId?: string;
  categoryId?: string;
  needWant?: "need" | "want";
  recurringRuleId?: string;
  receivableId?: string;
  counterpartyId?: string;
  splitId?: string;
  /** Owner's portion of a SplitBill, when this txn is the bill's source spend.
   *  When set, flowTotals/spendTotal treat only this portion as spend; the rest
   *  is reported as `lending_out` (effectively split_iou exposure). */
  splitOwnSharePaise?: number;
  /** When this txn is an EMI payment on a loan, the loan account it pays down. */
  debtAccountId?: string;
  /** Interest portion of an EMI (paise). principal = amountPaise - interestPortionPaise. */
  interestPortionPaise?: number;
}

export interface AccountLite {
  _id: string;
  classification: AccountClassification;
  openingBalancePaise: number;
  openingDate?: string;
}

export interface BalanceInput {
  transactions: TxnLite[];
  accounts: AccountLite[];
  cutoff?: string;
}

export interface AccountBalance {
  accountId: string;
  classification: AccountClassification;
  ownerPerspectivePaise: number;
  asOf: string;
}
