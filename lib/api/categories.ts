"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { invalidateLedger } from "./invalidate";
import type { ApiCategory } from "./types";
import type {
  CategoryCreateInput,
  CategoryUpdateInput,
} from "@/lib/schemas/category-input";

export const categoryKeys = {
  all: ["categories"] as const,
  list: (includeInactive: boolean) => ["categories", { includeInactive }] as const,
};

export function useCategories(opts: { includeInactive?: boolean } = {}) {
  const includeInactive = !!opts.includeInactive;
  return useQuery({
    queryKey: categoryKeys.list(includeInactive),
    queryFn: () =>
      api<{ items: ApiCategory[] }>(
        includeInactive ? "/api/categories?includeInactive=1" : "/api/categories",
      ).then((r) => r.items),
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    meta: { successMessage: "Category added" },
    mutationFn: (input: CategoryCreateInput) =>
      api<{ _id: string }>("/api/categories", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidateLedger(qc),
  });
}

export function useUpdateCategory(id: string) {
  const qc = useQueryClient();
  return useMutation({
    meta: { successMessage: "Category updated" },
    mutationFn: (input: CategoryUpdateInput) =>
      api<{ _id: string }>(`/api/categories/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidateLedger(qc),
  });
}

export function useArchiveCategory() {
  const qc = useQueryClient();
  return useMutation({
    meta: { successMessage: "Category archived" },
    mutationFn: (id: string) =>
      api<{ _id: string; isActive: boolean }>(`/api/categories/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => invalidateLedger(qc),
  });
}

export function useRestoreCategory() {
  const qc = useQueryClient();
  return useMutation({
    meta: { successMessage: "Category restored" },
    mutationFn: (id: string) =>
      api<{ _id: string; isActive: boolean }>(`/api/categories/${id}?restore=1`, {
        method: "DELETE",
      }),
    onSuccess: () => invalidateLedger(qc),
  });
}
