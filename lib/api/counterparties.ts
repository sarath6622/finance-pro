"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { invalidateLedger } from "./invalidate";
import type { ApiCounterparty } from "./types";
import type {
  CounterpartyCreateInput,
  CounterpartyUpdateInput,
} from "@/lib/schemas/counterparty-input";

export const counterpartyKeys = {
  all: ["counterparties"] as const,
  list: (includeInactive: boolean) => ["counterparties", { includeInactive }] as const,
};

export function useCounterparties(opts: { includeInactive?: boolean } = {}) {
  const includeInactive = !!opts.includeInactive;
  return useQuery({
    queryKey: counterpartyKeys.list(includeInactive),
    queryFn: () =>
      api<{ items: ApiCounterparty[] }>(
        includeInactive
          ? "/api/counterparties?includeInactive=1"
          : "/api/counterparties",
      ).then((r) => r.items),
  });
}

export function useCreateCounterparty() {
  const qc = useQueryClient();
  return useMutation({
    meta: { successMessage: "Counterparty added" },
    mutationFn: (input: CounterpartyCreateInput) =>
      api<{ _id: string }>("/api/counterparties", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidateLedger(qc),
  });
}

export function useUpdateCounterparty(id: string) {
  const qc = useQueryClient();
  return useMutation({
    meta: { successMessage: "Counterparty updated" },
    mutationFn: (input: CounterpartyUpdateInput) =>
      api<{ _id: string }>(`/api/counterparties/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidateLedger(qc),
  });
}

export function useArchiveCounterparty() {
  const qc = useQueryClient();
  return useMutation({
    meta: { successMessage: "Counterparty archived" },
    mutationFn: (id: string) =>
      api<{ _id: string; isActive: boolean }>(`/api/counterparties/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => invalidateLedger(qc),
  });
}

export function useRestoreCounterparty() {
  const qc = useQueryClient();
  return useMutation({
    meta: { successMessage: "Counterparty restored" },
    mutationFn: (id: string) =>
      api<{ _id: string; isActive: boolean }>(`/api/counterparties/${id}?restore=1`, {
        method: "DELETE",
      }),
    onSuccess: () => invalidateLedger(qc),
  });
}
