"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { invalidateLedger } from "./invalidate";
import type { SyncFields } from "./types";

export type ReceivableKind = "cash_loan" | "split_iou";
export type ReceivableStatus = "open" | "partial" | "closed" | "written_off";
export type AgeBucket = "0-30" | "30-90" | "90+" | "pay-when-able";
export type DueModel = "on_date" | "when_able" | "none";

export interface ApiReceivable extends SyncFields {
  _id: string;
  counterpartyId: string;
  kind: ReceivableKind;
  principalPaise: number;
  outstandingPaise: number;
  overpaymentPaise: number;
  dateIncurred: string;
  accountId?: string;
  dueModel: DueModel;
  status: ReceivableStatus;
  expectedReturnDate?: string;
  closedAt?: string;
  ageBucket: AgeBucket;
  notes?: string;
  reminderOptIn?: boolean;
}

export interface ApiReceivableExposure {
  asOf: string;
  totals: {
    outstandingPaise: number;
    cashLoanPaise: number;
    splitIouPaise: number;
    payWhenAblePaise: number;
    overpaymentPaise: number;
    byBucket: { "0-30": number; "30-90": number; "90+": number };
    counterpartyCount: number;
    hasPayWhenAble: boolean;
  };
  perCounterparty: Array<{
    counterpartyId: string;
    totalOutstandingPaise: number;
    cashLoanPaise: number;
    splitIouPaise: number;
    payWhenAblePaise: number;
    bucketCounts: { "0-30": number; "30-90": number; "90+": number; "pay-when-able": number };
    bucketTotals: { "0-30": number; "30-90": number; "90+": number };
    receivableIds: string[];
    oldestDateIncurred: string;
  }>;
}

export interface ApiReceivableDetail {
  asOf: string;
  receivable: ApiReceivable;
  repayments: Array<{
    _id: string;
    valueDate: string;
    amountPaise: number;
    flowType: "lending_repaid" | "reimbursement_in";
    description?: string;
    accountId?: string;
  }>;
}

export interface ApiByCounterparty {
  asOf: string;
  counterparty: { _id: string; displayName: string; type: string };
  totalOutstandingPaise: number;
  hasPayWhenAble: boolean;
  bucketCounts: { "0-30": number; "30-90": number; "90+": number; "pay-when-able": number };
  openOrPartial: ApiReceivable[];
  closed: ApiReceivable[];
  writtenOff: ApiReceivable[];
}

export const receivableKeys = {
  list: (filters: Record<string, string | undefined> = {}) =>
    ["receivables", "list", filters] as const,
  detail: (id: string) => ["receivables", "detail", id] as const,
  exposure: ["receivables", "exposure"] as const,
  byCounterparty: (id: string) => ["receivables", "by-counterparty", id] as const,
};

function qs(args: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(args)) {
    if (v !== undefined && v !== "") sp.set(k, v);
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export function useReceivables(
  filters: Partial<{
    status: ReceivableStatus;
    counterpartyId: string;
    kind: ReceivableKind;
    includeWrittenOff: boolean;
  }> = {},
) {
  const q: Record<string, string | undefined> = {};
  if (filters.status) q.status = filters.status;
  if (filters.counterpartyId) q.counterpartyId = filters.counterpartyId;
  if (filters.kind) q.kind = filters.kind;
  if (filters.includeWrittenOff) q.includeWrittenOff = "true";
  return useQuery({
    queryKey: receivableKeys.list(q),
    queryFn: () =>
      api<{ asOf: string; items: ApiReceivable[] }>(`/api/receivables${qs(q)}`),
  });
}

export function useReceivable(id: string) {
  return useQuery({
    queryKey: receivableKeys.detail(id),
    queryFn: () => api<ApiReceivableDetail>(`/api/receivables/${id}`),
    enabled: !!id,
  });
}

export function useReceivablesExposure() {
  return useQuery({
    queryKey: receivableKeys.exposure,
    queryFn: () => api<ApiReceivableExposure>("/api/receivables/exposure"),
    staleTime: 30_000,
  });
}

export function useReceivablesByCounterparty(counterpartyId: string) {
  return useQuery({
    queryKey: receivableKeys.byCounterparty(counterpartyId),
    queryFn: () =>
      api<ApiByCounterparty>(`/api/receivables/by-counterparty/${counterpartyId}`),
    enabled: !!counterpartyId,
  });
}

export interface WriteOffBody {
  notes?: string;
  categoryId?: string;
}

export function useWriteOffReceivable(receivableId: string) {
  const qc = useQueryClient();
  return useMutation({
    meta: { successMessage: "Receivable written off" },
    mutationFn: (body: WriteOffBody) =>
      api<{
        receivable: { _id: string; status: ReceivableStatus; closedAt?: string };
        compensatingTransaction: { _id: string; amountPaise: number };
      }>(`/api/receivables/${receivableId}/write-off`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateLedger(qc),
  });
}
