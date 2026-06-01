"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { invalidateLedger } from "./invalidate";
import { withOfflineFallback } from "./cache-bridge";
import { stripAccountBalance, stripAccountBalances } from "@/db/local/strip";
import type { ApiAccount } from "./types";
import type {
  AccountCreateInput,
  AccountUpdateInput,
} from "@/lib/schemas/account-input";

export const accountKeys = {
  all: ["accounts"] as const,
  list: (includeInactive: boolean) => ["accounts", { includeInactive }] as const,
  detail: (id: string) => ["accounts", id] as const,
};

export function useAccounts(opts: { includeInactive?: boolean } = {}) {
  const includeInactive = !!opts.includeInactive;
  const queryKey = accountKeys.list(includeInactive);
  return useQuery({
    queryKey,
    queryFn: withOfflineFallback<ApiAccount[]>({
      queryKey,
      networkFn: () =>
        api<{ items: ApiAccount[] }>(
          includeInactive ? "/api/accounts?includeInactive=1" : "/api/accounts",
        ).then((r) => r.items),
      beforeCache: stripAccountBalances,
    }),
  });
}

export function useAccount(id: string) {
  const queryKey = accountKeys.detail(id);
  return useQuery({
    queryKey,
    queryFn: withOfflineFallback<ApiAccount & { transactionCount: number }>({
      queryKey,
      networkFn: () =>
        api<ApiAccount & { transactionCount: number }>(`/api/accounts/${id}`),
      beforeCache: (data) => ({
        ...stripAccountBalance(data),
        transactionCount: data.transactionCount,
      }),
    }),
    enabled: !!id,
  });
}

export function useCreateAccount() {
  const qc = useQueryClient();
  return useMutation({
    meta: { successMessage: "Account added" },
    mutationFn: (input: AccountCreateInput) =>
      api<{ _id: string }>("/api/accounts", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidateLedger(qc),
  });
}

export function useUpdateAccount(id: string) {
  const qc = useQueryClient();
  return useMutation({
    meta: { successMessage: "Account updated" },
    mutationFn: (input: AccountUpdateInput) =>
      api<{ _id: string }>(`/api/accounts/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidateLedger(qc),
  });
}

export function useArchiveAccount() {
  const qc = useQueryClient();
  return useMutation({
    meta: { successMessage: "Account archived" },
    mutationFn: (id: string) =>
      api<{ _id: string; isActive: boolean }>(`/api/accounts/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => invalidateLedger(qc),
  });
}

export function useRestoreAccount() {
  const qc = useQueryClient();
  return useMutation({
    meta: { successMessage: "Account restored" },
    mutationFn: (id: string) =>
      api<{ _id: string; isActive: boolean }>(`/api/accounts/${id}?restore=1`, {
        method: "DELETE",
      }),
    onSuccess: () => invalidateLedger(qc),
  });
}
