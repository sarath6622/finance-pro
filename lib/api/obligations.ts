"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import { withOfflineFallback } from "./cache-bridge";
import type { FlowType } from "@/lib/schemas/common";

export type ObligationStatus =
  | "upcoming"
  | "due_today"
  | "overdue"
  | "paid"
  | "skipped";

export interface ApiObligation {
  ruleId: string;
  ruleLabel: string;
  expectedDate: string;
  amountPaise: number;
  flowType: FlowType;
  accountId: string;
  counterpartyId?: string;
  categoryId?: string;
  status: ObligationStatus;
  paidByTxnId?: string;
  cycleIndex?: number;
  totalCycles?: number;
  arrearsPolicy: "accumulate" | "skip";
}

export interface ApiObligationsBuckets {
  asOf: string;
  upcoming: ApiObligation[];
  arrears: ApiObligation[];
  paid: ApiObligation[];
}

export interface ObligationsArgs {
  asOf?: string;
  horizonDays?: number;
}

function qs(args: ObligationsArgs): string {
  const sp = new URLSearchParams();
  if (args.asOf) sp.set("asOf", args.asOf);
  if (args.horizonDays !== undefined) sp.set("horizonDays", String(args.horizonDays));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const obligationKeys = {
  list: (args: ObligationsArgs) => ["obligations", args] as const,
};

export function useObligations(args: ObligationsArgs = {}) {
  const queryKey = obligationKeys.list(args);
  return useQuery({
    queryKey,
    queryFn: withOfflineFallback<ApiObligationsBuckets>({
      queryKey,
      networkFn: () => api<ApiObligationsBuckets>(`/api/obligations${qs(args)}`),
    }),
  });
}
