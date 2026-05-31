"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { ApiAccount } from "./types";

export const accountKeys = {
  all: ["accounts"] as const,
  detail: (id: string) => ["accounts", id] as const,
};

export function useAccounts() {
  return useQuery({
    queryKey: accountKeys.all,
    queryFn: () => api<{ items: ApiAccount[] }>("/api/accounts").then((r) => r.items),
  });
}

export function useAccount(id: string) {
  return useQuery({
    queryKey: accountKeys.detail(id),
    queryFn: () => api<ApiAccount>(`/api/accounts/${id}`),
    enabled: !!id,
  });
}
