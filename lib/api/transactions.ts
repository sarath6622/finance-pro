"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { invalidateLedger } from "./invalidate";
import { withOfflineFallback } from "./cache-bridge";
import type {
  ApiTransaction,
  CardSettlementBody,
  CreateTransactionInput,
  PaginatedTransactions,
  PatchTransactionInput,
  SplitBody,
  TransferBody,
} from "./types";

export const txnKeys = {
  list: (filters: Record<string, string | number | undefined>) =>
    ["transactions", "list", filters] as const,
  detail: (id: string) => ["transactions", id] as const,
};

function buildQuery(filters: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v === undefined || v === "") continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export function useTransactions(filters: { accountId?: string; limit?: number } = {}) {
  const queryKey = txnKeys.list(filters);
  return useQuery({
    queryKey,
    queryFn: withOfflineFallback<PaginatedTransactions>({
      queryKey,
      networkFn: () =>
        api<PaginatedTransactions>(`/api/transactions${buildQuery(filters)}`),
    }),
  });
}

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    meta: { successMessage: "Transaction added" },
    mutationFn: (input: CreateTransactionInput) =>
      api<ApiTransaction>("/api/transactions", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidateLedger(qc),
  });
}

export function useUpdateTransaction(id: string) {
  const qc = useQueryClient();
  return useMutation({
    meta: { successMessage: "Transaction updated" },
    mutationFn: (patch: PatchTransactionInput) =>
      api<ApiTransaction>(`/api/transactions/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: () => invalidateLedger(qc),
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    meta: { successMessage: "Transaction deleted" },
    mutationFn: (id: string) =>
      api<ApiTransaction>(`/api/transactions/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidateLedger(qc),
  });
}

export function useSplitTransaction(parentId: string) {
  const qc = useQueryClient();
  return useMutation({
    meta: { successMessage: "Transaction split" },
    mutationFn: (body: SplitBody) =>
      api<{ children: ApiTransaction[] }>(`/api/transactions/${parentId}/split`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateLedger(qc),
  });
}

export function useCreateTransfer() {
  const qc = useQueryClient();
  return useMutation({
    meta: { successMessage: "Transfer recorded" },
    mutationFn: (body: TransferBody) =>
      api<{ legA: ApiTransaction; legB: ApiTransaction }>(
        "/api/transactions/transfer",
        { method: "POST", body: JSON.stringify(body) },
      ),
    onSuccess: () => invalidateLedger(qc),
  });
}

export function useCreateCardSettlement() {
  const qc = useQueryClient();
  return useMutation({
    meta: { successMessage: "Card payment recorded" },
    mutationFn: (body: CardSettlementBody) =>
      api<{ legBank: ApiTransaction; legCard: ApiTransaction }>(
        "/api/transactions/card-settlement",
        { method: "POST", body: JSON.stringify(body) },
      ),
    onSuccess: () => invalidateLedger(qc),
  });
}
