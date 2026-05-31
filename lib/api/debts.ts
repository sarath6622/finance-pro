"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { ApiAccount } from "./types";

export interface ApiAmortizationRow {
  monthIndex: number;
  paymentPaise: number;
  interestPaise: number;
  principalPaise: number;
  balancePaise: number;
}
export interface ApiAmortizationSchedule {
  emiPaise: number;
  totalInterestPaise: number;
  totalPaymentPaise: number;
  rows: ApiAmortizationRow[];
}
export interface ApiLoanSchedule {
  account: Pick<
    ApiAccount,
    "_id" | "name" | "openingBalancePaise"
  > & {
    interestRatePA: number;
    tenureMonths: number;
    emiAmountPaise?: number;
  };
  outstandingPaise: number;
  contractual: ApiAmortizationSchedule;
  remaining: ApiAmortizationSchedule | null;
}

export interface ApiLoanOutstanding {
  accountId: string;
  openingBalancePaise: number;
  outstandingPaise: number;
  interestRatePA?: number;
  emiAmountPaise?: number;
  tenureMonths?: number;
  rangeTotals?: {
    interestPaise: number;
    principalPaise: number;
    paymentPaise: number;
    txnCount: number;
  };
}

export interface ApiNetWorth {
  asOf: string;
  assets: {
    cashPaise: number;
    investmentPaise: number;
    receivablesPaise: number;
    totalPaise: number;
    perAccount: Array<{ accountId: string; name: string; kind: string; paise: number }>;
  };
  liabilities: {
    cardPaise: number;
    loanPaise: number;
    totalPaise: number;
    perAccount: Array<{
      accountId: string;
      name: string;
      kind: string;
      paise: number;
      emiPaise?: number;
      interestRatePA?: number;
    }>;
  };
  netWorthPaise: number;
  isInvestmentPartial: boolean;
}

export interface ApiPayoffPlan {
  strategy: "avalanche" | "snowball";
  totalMonths: number;
  totalInterestPaise: number;
  perLoan: Array<{
    loanId: string;
    name: string;
    payoffMonthIndex: number;
    interestPaidPaise: number;
  }>;
  months: Array<{
    monthIndex: number;
    totalPaymentPaise: number;
    totalInterestPaise: number;
    totalBalancePaise: number;
    freedEmiPaise: number;
  }>;
}

export interface ApiPayoffReport {
  asOf: string;
  surplusPerMonthPaise: number;
  loans: Array<{
    _id: string;
    name: string;
    outstandingPaise: number;
    interestRatePA: number;
    emiPaise: number;
  }>;
  avalanche: ApiPayoffPlan | null;
  snowball: ApiPayoffPlan | null;
  monthsDifferential: number;
  interestDifferentialPaise: number;
  recommendation: "avalanche" | "snowball" | "tied";
  redirect?: {
    redirectMonths: number;
    investedTotalPaise: number;
    futureValuePaise: number;
  };
}

export interface ApiEmiCalendar {
  asOf: string;
  totalMonths: number;
  totalEmiPaise: number;
  upcomingCount: number;
  overdueCount: number;
  months: Array<{
    yyyyMm: string;
    totalPaise: number;
    rows: Array<{
      ruleId: string;
      ruleLabel: string;
      expectedDate: string;
      amountPaise: number;
      status: "upcoming" | "due_today" | "overdue" | "paid" | "skipped";
      accountId: string;
      debtAccountId?: string;
      paidByTxnId?: string;
      cycleIndex?: number;
      totalCycles?: number;
    }>;
  }>;
}

export const debtsKeys = {
  schedule: (id: string) => ["debts", "schedule", id] as const,
  outstanding: (id: string) => ["debts", "outstanding", id] as const,
  payoff: (
    surplusPerMonthPaise: number,
    redirectReturnPct?: number,
    redirectHorizon?: number,
  ) =>
    [
      "debts",
      "payoff",
      surplusPerMonthPaise,
      redirectReturnPct ?? 0,
      redirectHorizon ?? 0,
    ] as const,
  netWorth: ["debts", "net-worth"] as const,
  emiCalendar: (horizonDays: number) => ["debts", "emi-calendar", horizonDays] as const,
};

export function useLoanSchedule(id: string) {
  return useQuery({
    queryKey: debtsKeys.schedule(id),
    queryFn: () => api<ApiLoanSchedule>(`/api/accounts/${id}/schedule`),
    enabled: !!id,
  });
}

export function useLoanOutstanding(id: string) {
  return useQuery({
    queryKey: debtsKeys.outstanding(id),
    queryFn: () => api<ApiLoanOutstanding>(`/api/accounts/${id}/outstanding`),
    enabled: !!id,
  });
}

export function usePayoffReport(
  surplusPerMonthPaise: number,
  opts: { redirectReturnPct?: number; redirectHorizonMonths?: number } = {},
) {
  const q = new URLSearchParams();
  q.set("surplusPerMonthPaise", String(surplusPerMonthPaise));
  if (opts.redirectReturnPct !== undefined) {
    q.set("redirectAnnualReturnPct", String(opts.redirectReturnPct));
  }
  if (opts.redirectHorizonMonths !== undefined) {
    q.set("redirectHorizonMonths", String(opts.redirectHorizonMonths));
  }
  return useQuery({
    queryKey: debtsKeys.payoff(
      surplusPerMonthPaise,
      opts.redirectReturnPct,
      opts.redirectHorizonMonths,
    ),
    queryFn: () => api<ApiPayoffReport>(`/api/reports/payoff?${q.toString()}`),
    staleTime: 10_000,
  });
}

export function useNetWorth() {
  return useQuery({
    queryKey: debtsKeys.netWorth,
    queryFn: () => api<ApiNetWorth>(`/api/reports/net-worth`),
    staleTime: 30_000,
  });
}

export function useEmiCalendar(horizonDays = 180) {
  return useQuery({
    queryKey: debtsKeys.emiCalendar(horizonDays),
    queryFn: () =>
      api<ApiEmiCalendar>(`/api/reports/emi-calendar?horizonDays=${horizonDays}`),
    staleTime: 30_000,
  });
}
