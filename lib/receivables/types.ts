import type { FlowType } from "@/lib/schemas/common";

export type ReceivableKind = "cash_loan" | "split_iou";
export type ReceivableStatus = "open" | "partial" | "closed" | "written_off";
export type DueModel = "on_date" | "when_able" | "none";
export type AgeBucket = "0-30" | "30-90" | "90+" | "pay-when-able";

export interface ReceivableLite {
  _id: string;
  counterpartyId: string;
  kind: ReceivableKind;
  principalPaise: number;
  dateIncurred: string;
  accountId?: string;
  dueModel: DueModel;
  expectedReturnDate?: string;
  status: ReceivableStatus;
  repaymentTxnIds: string[];
  splitId?: string;
  closedAt?: string;
  isDeleted?: boolean;
}

export interface RepaymentLite {
  _id: string;
  receivableId: string;
  valueDate: string;
  amountPaise: number;
  isDeleted: boolean;
  flowType: FlowType;
}

export interface ReceivableDerived {
  outstandingPaise: number;
  overpaymentPaise: number;
  ageBucket: AgeBucket;
}

export interface ReceivableNext {
  status: ReceivableStatus;
  closedAt?: string;
  repaymentTxnIds: string[];
  outstandingPaise: number;
  overpaymentPaise: number;
}

export interface BucketCounts {
  "0-30": number;
  "30-90": number;
  "90+": number;
  "pay-when-able": number;
}

export interface CounterpartyExposure {
  counterpartyId: string;
  totalOutstandingPaise: number;
  cashLoanPaise: number;
  splitIouPaise: number;
  payWhenAblePaise: number;
  bucketCounts: BucketCounts;
  bucketTotals: { "0-30": number; "30-90": number; "90+": number };
  receivableIds: string[];
  oldestDateIncurred: string;
}

export interface ExposureTotals {
  outstandingPaise: number;
  cashLoanPaise: number;
  splitIouPaise: number;
  payWhenAblePaise: number;
  overpaymentPaise: number;
  byBucket: { "0-30": number; "30-90": number; "90+": number };
  counterpartyCount: number;
  hasPayWhenAble: boolean;
}

export interface R14Result {
  asOf: string;
  totals: ExposureTotals;
  perCounterparty: CounterpartyExposure[];
}
