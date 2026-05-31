"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { invalidateLedger } from "./invalidate";
import type { SyncFields } from "./types";

export type AssetType = "crypto" | "stock" | "mutual_fund";
export type PriceCurrency = "INR" | "USD";

export interface ApiHolding extends SyncFields {
  _id: string;
  assetType: AssetType;
  symbol: string;
  name: string;
  platform: string;
  quantity: number;
  currentUnitPricePaise?: number;
  priceCurrency: PriceCurrency;
  fxRateToInr?: number;
  priceUpdatedAt?: string;
  priceSource: "manual" | "auto";
  realizedPnLPaise: number;
  isActive: boolean;
  marketValuePaise: number;
  costBasisPaise: number;
  unrealizedPnLPaise: number;
  isStalePrice: boolean;
  isInvestmentPartial: boolean;
  lots: Array<{ date: string; quantity: number; unitCostPaise: number; txnId?: string }>;
}

export interface ApiHoldingDetail {
  holding: Omit<
    ApiHolding,
    "marketValuePaise" | "costBasisPaise" | "unrealizedPnLPaise" | "isStalePrice" | "isInvestmentPartial"
  >;
  valuation: {
    unitPriceInrPaise: number;
    marketValuePaise: number;
    costBasisPaise: number;
    unrealizedPnLPaise: number;
    realizedPnLPaise: number;
    isStalePrice: boolean;
    isInvestmentPartial: boolean;
    priceUpdatedAt?: string;
  };
  corporateActions: Array<{
    at: string;
    kind: "split" | "bonus";
    ratioNumerator: number;
    ratioDenominator: number;
    notes?: string;
  }>;
  transactions: Array<{
    _id: string;
    valueDate: string;
    flowType: string;
    direction: "in" | "out";
    amountPaise: number;
    accountId: string;
    description: string;
  }>;
}

export interface ApiPortfolioBucket {
  key: string;
  marketValuePaise: number;
  costBasisPaise: number;
  unrealizedPnLPaise: number;
  pct: number;
  holdingCount: number;
}

export interface ApiPortfolio {
  asOf: string;
  totals: {
    marketValuePaise: number;
    costBasisPaise: number;
    unrealizedPnLPaise: number;
    realizedPnLPaise: number;
    holdingCount: number;
    stalePriceCount: number;
  };
  byAssetType: ApiPortfolioBucket[];
  byPlatform: ApiPortfolioBucket[];
  holdings: Array<{
    holdingId: string;
    symbol?: string;
    name?: string;
    platform?: string;
    assetType?: AssetType;
    priceCurrency?: PriceCurrency;
    quantity: number;
    unitPriceInrPaise: number;
    marketValuePaise: number;
    costBasisPaise: number;
    unrealizedPnLPaise: number;
    realizedPnLPaise: number;
    isStalePrice: boolean;
    isInvestmentPartial: boolean;
    priceUpdatedAt?: string;
  }>;
}

export const holdingsKeys = {
  list: ["holdings", "list"] as const,
  detail: (id: string) => ["holdings", "detail", id] as const,
  portfolio: ["reports", "portfolio"] as const,
};

export function useHoldings() {
  return useQuery({
    queryKey: holdingsKeys.list,
    queryFn: () => api<{ items: ApiHolding[] }>(`/api/holdings`),
    staleTime: 10_000,
  });
}

export function useHolding(id: string) {
  return useQuery({
    queryKey: holdingsKeys.detail(id),
    queryFn: () => api<ApiHoldingDetail>(`/api/holdings/${id}`),
    enabled: !!id,
  });
}

export function usePortfolio() {
  return useQuery({
    queryKey: holdingsKeys.portfolio,
    queryFn: () => api<ApiPortfolio>(`/api/reports/portfolio`),
    staleTime: 30_000,
  });
}

export function useCreateHolding() {
  const qc = useQueryClient();
  return useMutation({
    meta: { successMessage: "Holding added" },
    mutationFn: (body: {
      assetType: AssetType;
      symbol: string;
      name: string;
      platform: string;
      priceCurrency?: PriceCurrency;
      notes?: string;
    }) =>
      api<ApiHolding>(`/api/holdings`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => invalidateLedger(qc),
  });
}

export interface BuyBody {
  date: string;
  quantity: number;
  unitCostPaise: number;
  payerAccountId: string;
  description?: string;
  notes?: string;
}

export function useBuyHolding(id: string) {
  const qc = useQueryClient();
  return useMutation({
    meta: { successMessage: "Buy recorded" },
    mutationFn: (body: BuyBody) =>
      api<{ transactionId: string; newQuantity: number }>(
        `/api/holdings/${id}/buy`,
        { method: "POST", body: JSON.stringify(body) },
      ),
    onSuccess: () => invalidateLedger(qc),
  });
}

export interface ImportLotBody {
  date: string;
  quantity: number;
  unitCostPaise: number;
  notes?: string;
}

export function useImportLot(id: string) {
  const qc = useQueryClient();
  return useMutation({
    meta: { successMessage: "Position imported" },
    mutationFn: (body: ImportLotBody) =>
      api<{ holdingId: string; newQuantity: number }>(
        `/api/holdings/${id}/import-lot`,
        { method: "POST", body: JSON.stringify(body) },
      ),
    onSuccess: () => invalidateLedger(qc),
  });
}

export interface SellBody {
  date: string;
  quantity: number;
  unitPricePaise: number;
  receiverAccountId: string;
  description?: string;
  notes?: string;
}

export function useSellHolding(id: string) {
  const qc = useQueryClient();
  return useMutation({
    meta: { successMessage: "Sell recorded" },
    mutationFn: (body: SellBody) =>
      api<{
        transactionId: string;
        newQuantity: number;
        realizedPnLPaise: number;
        totalProceedsPaise: number;
        consumed: Array<{ lotDate: string; qtyConsumed: number; realizedPnLPaise: number }>;
      }>(`/api/holdings/${id}/sell`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => invalidateLedger(qc),
  });
}

export interface CorporateActionBody {
  kind: "split" | "bonus";
  ratioNumerator: number;
  ratioDenominator: number;
  notes?: string;
}

export function useCorporateAction(id: string) {
  const qc = useQueryClient();
  return useMutation({
    meta: { successMessage: "Corporate action applied" },
    mutationFn: (body: CorporateActionBody) =>
      api<{ newQuantity: number }>(`/api/holdings/${id}/corporate-action`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateLedger(qc),
  });
}

export interface TransferBody {
  date: string;
  quantity: number;
  toPlatform: string;
  notes?: string;
}

export function useTransferHolding(id: string) {
  const qc = useQueryClient();
  return useMutation({
    meta: { successMessage: "Holding transferred" },
    mutationFn: (body: TransferBody) =>
      api<{
        sourceHoldingId: string;
        destHoldingId: string;
        movedQuantity: number;
      }>(`/api/holdings/${id}/transfer`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => invalidateLedger(qc),
  });
}

export interface PriceUpdateBody {
  unitPricePaise: number;
  priceCurrency?: PriceCurrency;
  fxRateToInr?: number;
  source?: "manual" | "auto";
}

export function useUpdatePrice(id: string) {
  const qc = useQueryClient();
  return useMutation({
    meta: { successMessage: "Price updated" },
    mutationFn: (body: PriceUpdateBody) =>
      api<{ unitPricePaise: number }>(`/api/holdings/${id}/price`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateLedger(qc),
  });
}

export function useDeleteHolding(id: string) {
  const qc = useQueryClient();
  return useMutation({
    meta: { successMessage: "Holding deleted" },
    mutationFn: () => api<{ _id: string }>(`/api/holdings/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidateLedger(qc),
  });
}
