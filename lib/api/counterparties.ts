"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { ApiCounterparty } from "./types";

export const counterpartyKeys = { all: ["counterparties"] as const };

export function useCounterparties() {
  return useQuery({
    queryKey: counterpartyKeys.all,
    queryFn: () =>
      api<{ items: ApiCounterparty[] }>("/api/counterparties").then((r) => r.items),
  });
}
