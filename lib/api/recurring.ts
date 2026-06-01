"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { invalidateLedger } from "./invalidate";
import { withOfflineFallback } from "./cache-bridge";
import type { SyncFields } from "./types";
import type { FlowType } from "@/lib/schemas/common";

export interface ApiRecurringRule extends SyncFields {
  _id: string;
  label: string;
  accountId: string;
  counterpartyId?: string;
  categoryId?: string;
  flowType: FlowType;
  amountPaise: number;
  frequency: "monthly" | "weekly" | "custom";
  dayOfMonth?: number;
  startDate: string;
  endDate?: string;
  arrearsPolicy: "accumulate" | "skip";
  status: "active" | "paused" | "ended";
  autoGenerate: boolean;
}

export interface RecurringRuleCreateBody {
  label: string;
  accountId: string;
  counterpartyId?: string;
  categoryId?: string;
  flowType: FlowType;
  amountPaise: number;
  frequency: "monthly" | "weekly" | "custom";
  dayOfMonth?: number;
  startDate: string;
  endDate?: string;
  arrearsPolicy?: "accumulate" | "skip";
  status?: "active" | "paused" | "ended";
  autoGenerate?: boolean;
}

export const recurringKeys = { all: ["recurring"] as const };

export function useRecurringRules() {
  return useQuery({
    queryKey: recurringKeys.all,
    queryFn: withOfflineFallback<ApiRecurringRule[]>({
      queryKey: recurringKeys.all,
      networkFn: () =>
        api<{ items: ApiRecurringRule[] }>("/api/recurring").then((r) => r.items),
    }),
  });
}

export function useCreateRecurringRule() {
  const qc = useQueryClient();
  return useMutation({
    meta: { successMessage: "Recurring rule created" },
    mutationFn: (body: RecurringRuleCreateBody) =>
      api<ApiRecurringRule>("/api/recurring", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateLedger(qc),
  });
}

export function useUpdateRecurringRule(id: string) {
  const qc = useQueryClient();
  return useMutation({
    meta: { successMessage: "Recurring rule updated" },
    mutationFn: (patch: Partial<ApiRecurringRule>) =>
      api<ApiRecurringRule>(`/api/recurring/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: () => invalidateLedger(qc),
  });
}

export function useEndRecurringRule() {
  const qc = useQueryClient();
  return useMutation({
    meta: { successMessage: "Recurring rule ended" },
    mutationFn: (id: string) =>
      api<ApiRecurringRule>(`/api/recurring/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidateLedger(qc),
  });
}
