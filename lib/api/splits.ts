"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { invalidateLedger } from "./invalidate";
import { withOfflineFallback } from "./cache-bridge";
import type { SyncFields } from "./types";

export type SplitStatus = "open" | "partial" | "settled";

export interface ApiSplitParticipant {
  counterpartyId: string;
  sharePaise: number;
  settledPaise: number;
  status: SplitStatus;
  dueModel: "on_date" | "when_able" | "none";
  receivableId?: string;
  outstandingPaise?: number;
  receivableStatus?: "open" | "partial" | "closed" | "written_off";
}

export interface ApiSplitBill extends SyncFields {
  _id: string;
  sourceTransactionId: string;
  totalPaise: number;
  payerAccountId: string;
  categoryId?: string;
  ownSharePaise: number;
  status: SplitStatus;
  participants: ApiSplitParticipant[];
  notes?: string;
  createdAt?: string;
}

export interface ApiR15 {
  asOf: string;
  totals: {
    bills: number;
    openCount: number;
    partialCount: number;
    settledCount: number;
    totalPaise: number;
    outstandingPaise: number;
  };
  buckets: Record<SplitStatus, { count: number; totalPaise: number; outstandingPaise: number }>;
  bills: Array<{
    splitBillId: string;
    sourceTransactionId: string;
    totalPaise: number;
    ownSharePaise: number;
    status: SplitStatus;
    participantCount: number;
    outstandingPaise: number;
    settledPaise: number;
    createdAt?: string;
    isTurf?: boolean;
  }>;
}

export const splitKeys = {
  list: (status?: SplitStatus) => ["splits", "list", status ?? "all"] as const,
  detail: (id: string) => ["splits", "detail", id] as const,
  report: ["splits", "report"] as const,
};

export function useSplitBills(status?: SplitStatus) {
  const queryKey = splitKeys.list(status);
  return useQuery({
    queryKey,
    queryFn: withOfflineFallback<{ items: ApiSplitBill[] }>({
      queryKey,
      networkFn: () =>
        api<{ items: ApiSplitBill[] }>(
          `/api/split-bills${status ? `?status=${status}` : ""}`,
        ),
    }),
  });
}

export function useSplitBill(id: string) {
  const queryKey = splitKeys.detail(id);
  return useQuery({
    queryKey,
    queryFn: withOfflineFallback<ApiSplitBill>({
      queryKey,
      networkFn: () => api<ApiSplitBill>(`/api/split-bills/${id}`),
    }),
    enabled: !!id,
  });
}

export function useSplitsReport() {
  return useQuery({
    queryKey: splitKeys.report,
    queryFn: withOfflineFallback<ApiR15>({
      queryKey: splitKeys.report,
      networkFn: () => api<ApiR15>("/api/reports/splits"),
    }),
    staleTime: 30_000,
  });
}

export interface CreateSplitBody {
  sourceTransactionId: string;
  totalPaise: number;
  ownSharePaise: number;
  participants: Array<{
    counterpartyId: string;
    sharePaise: number;
    dueModel?: "on_date" | "when_able" | "none";
  }>;
  notes?: string;
}

export function useCreateSplitBill() {
  const qc = useQueryClient();
  return useMutation({
    meta: { successMessage: "Bill split created" },
    mutationFn: (body: CreateSplitBody) =>
      api<{ splitBillId: string; receivableIds: string[]; ownSharePaise: number }>(
        "/api/split-bills",
        { method: "POST", body: JSON.stringify(body) },
      ),
    onSuccess: () => invalidateLedger(qc),
  });
}

export interface TurfBody {
  payerAccountId: string;
  categoryId?: string;
  unitPaise: number;
  counterpartyIds: string[];
  includeOwner: boolean;
  valueDate: string;
  description?: string;
  notes?: string;
}

export function useCreateTurfBill() {
  const qc = useQueryClient();
  return useMutation({
    meta: { successMessage: "Turf bill created" },
    mutationFn: (body: TurfBody) =>
      api<{
        transactionId: string;
        splitBillId: string;
        receivableIds: string[];
        totalPaise: number;
      }>("/api/split-bills/turf", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateLedger(qc),
  });
}

export function useWriteOffParticipant(splitBillId: string, counterpartyId: string) {
  const qc = useQueryClient();
  return useMutation({
    meta: { successMessage: "Participant written off" },
    mutationFn: (body: { categoryId?: string; notes?: string } = {}) =>
      api<{ receivableId: string; compensatingTxnId: string; participantSettled: boolean }>(
        `/api/split-bills/${splitBillId}/participants/${counterpartyId}/write-off`,
        { method: "POST", body: JSON.stringify(body) },
      ),
    onSuccess: () => invalidateLedger(qc),
  });
}

export interface MatchProposal {
  receivableId: string;
  counterpartyId: string;
  outstandingPaise: number;
  splitId?: string;
  dateIncurred: string;
  kind: "cash_loan" | "split_iou";
}

export function useMatchProposal(counterpartyId: string | undefined) {
  const queryKey = [
    "receivables",
    "match-proposal",
    counterpartyId ?? "none",
  ] as const;
  return useQuery({
    queryKey,
    queryFn: withOfflineFallback<{ match: MatchProposal | null }>({
      queryKey,
      networkFn: () =>
        api<{ match: MatchProposal | null }>(
          `/api/receivables/match-proposal?counterpartyId=${counterpartyId}`,
        ),
    }),
    enabled: !!counterpartyId,
    staleTime: 10_000,
  });
}
