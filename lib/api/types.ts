import type {
  AccountClassification,
  AccountKind,
  CounterpartyType,
  FlowType,
  NeedWant,
  ReviewStatus,
  TxnDirection,
  TxnSource,
} from "@/lib/schemas/common";

/** Fields every sync-eligible entity gets (see P10 plan). */
export interface SyncFields {
  version: number;
  bookedAt: string;
  clientEntityId?: string;
}

export interface ApiAccount extends SyncFields {
  _id: string;
  name: string;
  kind: AccountKind;
  classification: AccountClassification;
  institution?: string;
  last4Label?: string;
  openingBalancePaise: number;
  openingDate?: string;
  creditLimitPaise?: number;
  statementDay?: number;
  dueDay?: number;
  interestRatePA?: number;
  tenureMonths?: number;
  emiAmountPaise?: number;
  isActive: boolean;
  archivedAt?: string;
  balancePaise: number;
}

export interface ApiCounterparty extends SyncFields {
  _id: string;
  displayName: string;
  type: CounterpartyType;
  aliases: string[];
  defaultFlowType?: FlowType;
  defaultCategoryId?: string;
  notes?: string;
  isActive: boolean;
  archivedAt?: string;
}

export interface ApiCategory extends SyncFields {
  _id: string;
  name: string;
  slug: string;
  parentId?: string;
  defaultFlowType?: FlowType;
  icon?: string;
  color?: string;
  sortOrder: number;
  isActive: boolean;
}

export interface ApiTransaction extends SyncFields {
  _id: string;
  valueDate: string;
  amountPaise: number;
  direction: TxnDirection;
  flowType: FlowType;
  needWant?: NeedWant;
  categoryId?: string;
  accountId: string;
  counterpartyId?: string;
  source: TxnSource;
  description: string;
  notes?: string;
  parentTransactionId?: string;
  receivableId?: string;
  splitId?: string;
  reimbursesTransactionId?: string;
  reviewStatus: ReviewStatus;
  isDeleted: boolean;
  deletedAt?: string;
}

export interface PaginatedTransactions {
  items: ApiTransaction[];
  nextCursor: string | null;
}

export interface CreateTransactionInput {
  valueDate: string;
  bookedAt?: string;
  amountPaise: number;
  direction: TxnDirection;
  flowType: FlowType;
  needWant?: NeedWant;
  categoryId?: string;
  accountId: string;
  counterpartyId?: string;
  recurringRuleId?: string;
  receivableId?: string;
  dueModel?: "on_date" | "when_able" | "none";
  expectedReturnDate?: string;
  reminderOptIn?: boolean;
  acceptOverpayment?: boolean;
  description?: string;
  notes?: string;
}

export interface PatchTransactionInput {
  valueDate?: string;
  amountPaise?: number;
  direction?: TxnDirection;
  flowType?: FlowType;
  needWant?: NeedWant;
  categoryId?: string;
  accountId?: string;
  counterpartyId?: string;
  description?: string;
  notes?: string;
}

export interface SplitChildBody {
  amountPaise: number;
  flowType: FlowType;
  needWant?: NeedWant;
  categoryId?: string;
  counterpartyId?: string;
  description?: string;
  notes?: string;
}

export interface SplitBody {
  children: SplitChildBody[];
}

export interface TransferBody {
  fromAccountId: string;
  toAccountId: string;
  amountPaise: number;
  valueDate: string;
  description?: string;
  notes?: string;
}

export interface CardSettlementBody {
  fromAccountId: string;
  toCardAccountId: string;
  amountPaise: number;
  valueDate: string;
  description?: string;
  notes?: string;
  acceptUnderpayment?: boolean;
}
