"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { invalidateLedger } from "./invalidate";

export interface ApiSettings {
  liquidityFloorPaise: number;
  reminderTime: string;
  paydayDayOfMonth: number;
  baseCurrency: "INR";
  payCycleMode: "calendar" | "pay_cycle";
  includePassthroughInReports: boolean;
}

export const settingsKeys = { current: ["settings"] as const };

export function useSettings() {
  return useQuery({
    queryKey: settingsKeys.current,
    queryFn: () => api<ApiSettings>("/api/settings"),
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    meta: { successMessage: "Settings saved" },
    mutationFn: (patch: Partial<ApiSettings>) =>
      api<ApiSettings>("/api/settings", {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: settingsKeys.current });
      invalidateLedger(qc);
    },
  });
}
