"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import { withOfflineFallback } from "./cache-bridge";

export type PeriodMode = "calendar" | "pay_cycle";

export interface ReportPeriod {
  mode: PeriodMode;
  anchorDay: number;
  year: number;
  month: number;
  start: string;
  endInclusive: string;
  label: string;
}

export interface MonthOverviewResult {
  period: ReportPeriod;
  txnCount: number;
  byFlowType: Record<string, number>;
  spend: { need: number; want: number; unclassified: number; fee: number; total: number };
  income: number;
  familySupport: number;
  debtRepayment: number;
  investment: number;
  lendingOut: number;
  lendingRepaid: number;
  reimbursementIn: number;
  cardSettlement: number;
  transfer: number;
}

export interface BudgetVsActualRow {
  categoryId: string;
  categoryName: string;
  budgetPaise: number;
  actualPaise: number;
  variancePaise: number;
  utilizationPct: number;
  rollover: boolean;
  status: "under" | "at" | "over" | "no-budget";
}

export interface BudgetVsActualResult {
  period: ReportPeriod;
  totals: { budgetedPaise: number; actualPaise: number; variancePaise: number };
  byCategory: BudgetVsActualRow[];
  unbudgeted: Array<{ categoryId: string; categoryName: string; actualPaise: number }>;
}

export interface PeriodArgs {
  year: number;
  month: number;
  mode?: PeriodMode;
}

function qs(args: PeriodArgs): string {
  const sp = new URLSearchParams();
  sp.set("year", String(args.year));
  sp.set("month", String(args.month));
  if (args.mode) sp.set("mode", args.mode);
  return `?${sp.toString()}`;
}

export const reportKeys = {
  monthOverview: (args: PeriodArgs) => ["reports", "month-overview", args] as const,
  budgetVsActual: (args: PeriodArgs) => ["reports", "budget-vs-actual", args] as const,
};

export function useMonthOverview(args: PeriodArgs) {
  const queryKey = reportKeys.monthOverview(args);
  return useQuery({
    queryKey,
    queryFn: withOfflineFallback<MonthOverviewResult>({
      queryKey,
      networkFn: () => api<MonthOverviewResult>(`/api/reports/month-overview${qs(args)}`),
    }),
  });
}

export function useBudgetVsActual(args: PeriodArgs) {
  const queryKey = reportKeys.budgetVsActual(args);
  return useQuery({
    queryKey,
    queryFn: withOfflineFallback<BudgetVsActualResult>({
      queryKey,
      networkFn: () => api<BudgetVsActualResult>(`/api/reports/budget-vs-actual${qs(args)}`),
    }),
  });
}
