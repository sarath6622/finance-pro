"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "./client";

export interface ApiLiquidityForecast {
  asOf: string;
  horizonEnd: string;
  startingPaise: number;
  floorPaise: number;
  minPaise: number;
  minDate: string;
  firstFloorBreachDate?: string;
  firstOverdraftDate?: string;
  netChangePaise: number;
  nextPayday: string;
  days: Array<{
    date: string;
    endPaise: number;
    netPaise: number;
    headroomPaise: number;
    belowFloor: boolean;
    overdrawn: boolean;
  }>;
  flows: Array<{
    date: string;
    signedPaise: number;
    label: string;
    source?: string;
  }>;
  liquidPerAccount: Array<{ _id: string; name: string; paise: number }>;
}

export interface ApiBurnDown {
  asOf: string;
  cycleStart: string;
  cycleEnd: string;
  paydayInflowPaise: number;
  totalDays: number;
  daysElapsed: number;
  curve: Array<{ date: string; balancePaise: number; netPaise: number }>;
  idealCurve: Array<{ date: string; idealPaise: number }>;
  totalOutflowPaise: number;
}

export interface ApiCashFlow {
  period: {
    mode: "calendar" | "pay_cycle";
    year: number;
    month: number;
    start: string;
    endInclusive: string;
    label: string;
  };
  txnCount: number;
  perFlowType: Record<
    string,
    { inflowPaise: number; outflowPaise: number; netPaise: number }
  >;
  trueInflowPaise: number;
  trueOutflowPaise: number;
  netCashFlowPaise: number;
  totalInflowPaise: number;
  totalOutflowPaise: number;
}

export interface ApiLendSafety {
  proposedDate: string;
  amountPaise: number;
  baselineMinPaise: number;
  hypotheticalMinPaise: number;
  hypotheticalMinDate: string;
  wouldBreachFloor: boolean;
  wouldOverdraw: boolean;
  safeLendCeilingPaise: number;
  floorPaise: number;
}

export const liquidityKeys = {
  forecast: ["liquidity", "forecast"] as const,
  burnDown: ["liquidity", "burn-down"] as const,
  cashFlow: (year: number, month: number, mode: string) =>
    ["liquidity", "cash-flow", year, month, mode] as const,
  lendSafety: (amountPaise: number, date?: string) =>
    ["liquidity", "lend-safety", amountPaise, date ?? "today"] as const,
};

export function useLiquidityForecast() {
  return useQuery({
    queryKey: liquidityKeys.forecast,
    queryFn: () => api<ApiLiquidityForecast>("/api/reports/liquidity-forecast"),
    staleTime: 30_000,
  });
}

export function useBurnDown() {
  return useQuery({
    queryKey: liquidityKeys.burnDown,
    queryFn: () => api<ApiBurnDown>("/api/reports/burn-down"),
    staleTime: 30_000,
  });
}

export function useCashFlow(year: number, month: number, mode: "calendar" | "pay_cycle") {
  return useQuery({
    queryKey: liquidityKeys.cashFlow(year, month, mode),
    queryFn: () =>
      api<ApiCashFlow>(
        `/api/reports/cash-flow?year=${year}&month=${month}&mode=${mode}`,
      ),
    staleTime: 30_000,
  });
}

export function useLendSafety(amountPaise: number | null, date?: string) {
  return useQuery({
    queryKey: liquidityKeys.lendSafety(amountPaise ?? 0, date),
    queryFn: () => {
      const sp = new URLSearchParams();
      sp.set("amountPaise", String(amountPaise));
      if (date) sp.set("date", date);
      return api<ApiLendSafety>(`/api/lend-safety?${sp.toString()}`);
    },
    enabled: !!amountPaise && amountPaise > 0,
    staleTime: 10_000,
  });
}
