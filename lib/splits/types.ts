import type { DueModel, ReceivableLite } from "@/lib/receivables/types";

export type ParticipantStatus = "open" | "partial" | "settled";
export type SplitBillStatus = "open" | "partial" | "settled";

export interface ParticipantLite {
  counterpartyId: string;
  sharePaise: number;
  settledPaise: number;
  status: ParticipantStatus;
  dueModel: DueModel;
  receivableId?: string;
}

export interface SplitBillLite {
  _id: string;
  sourceTransactionId: string;
  totalPaise: number;
  payerAccountId: string;
  categoryId?: string;
  participants: ParticipantLite[];
  ownSharePaise: number;
  status: SplitBillStatus;
  isDeleted?: boolean;
  createdAt?: string;
  notes?: string;
}

export interface ProposedShare {
  counterpartyId: string;
  sharePaise: number;
  dueModel?: DueModel;
}

export interface ConvertToSplitInput {
  sourceTransactionId: string;
  totalPaise: number;
  ownSharePaise: number;
  participants: ProposedShare[];
}

export interface MatchProposal {
  receivableId: string;
  counterpartyId: string;
  outstandingPaise: number;
  splitId?: string;
  dateIncurred: string;
  kind: ReceivableLite["kind"];
}
