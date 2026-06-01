"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { invalidateLedger } from "./invalidate";
import { withOfflineFallback } from "./cache-bridge";

export interface ApiSettings {
  liquidityFloorPaise: number;
  reminderTime: string;
  paydayDayOfMonth: number;
  baseCurrency: "INR";
  payCycleMode: "calendar" | "pay_cycle";
  includePassthroughInReports: boolean;
  version: number;
  bookedAt: string;
}

export const settingsKeys = { current: ["settings"] as const };

export function useSettings() {
  return useQuery({
    queryKey: settingsKeys.current,
    queryFn: withOfflineFallback<ApiSettings>({
      queryKey: settingsKeys.current,
      networkFn: () => api<ApiSettings>("/api/settings"),
    }),
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
