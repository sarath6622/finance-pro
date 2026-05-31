"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { invalidateLedger } from "./invalidate";

export interface ApiBudget {
  _id: string;
  categoryId: string;
  month: string;
  amountPaise: number;
  rollover: boolean;
}

export interface BudgetUpsertBody {
  categoryId: string;
  month: string;
  amountPaise: number;
  rollover?: boolean;
}

export const budgetKeys = {
  list: (month?: string) => ["budgets", { month }] as const,
};

export function useBudgets(month?: string) {
  return useQuery({
    queryKey: budgetKeys.list(month),
    queryFn: () => {
      const q = month ? `?month=${encodeURIComponent(month)}` : "";
      return api<{ items: ApiBudget[] }>(`/api/budgets${q}`).then((r) => r.items);
    },
  });
}

export function useUpsertBudget() {
  const qc = useQueryClient();
  return useMutation({
    meta: { successMessage: "Budget saved" },
    mutationFn: (body: BudgetUpsertBody) =>
      api<ApiBudget>("/api/budgets", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateLedger(qc),
  });
}

export function useDeleteBudget() {
  const qc = useQueryClient();
  return useMutation({
    meta: { successMessage: "Budget deleted" },
    mutationFn: (id: string) =>
      api<{ ok: boolean }>(`/api/budgets/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidateLedger(qc),
  });
}
