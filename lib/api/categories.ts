"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { ApiCategory } from "./types";

export const categoryKeys = { all: ["categories"] as const };

export function useCategories() {
  return useQuery({
    queryKey: categoryKeys.all,
    queryFn: () => api<{ items: ApiCategory[] }>("/api/categories").then((r) => r.items),
  });
}
