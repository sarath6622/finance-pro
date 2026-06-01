/**
 * Cache bridge for offline-first read queries.
 *
 * Each wrapped queryFn:
 *   1. Hits the network as normal.
 *   2. On success, persists the (optionally stripped) payload to idb.
 *   3. On network failure or 5xx, falls back to the cached payload if any.
 *   4. On 401, purges the cached payload and rethrows so the signin
 *      flow does not show stale data (security note in plan §10).
 *
 * Any other error (4xx validation, etc.) bypasses the cache entirely
 * because the *request* is wrong — fixing it client-side will retry.
 */

import { ApiClientError } from "./client";
import {
  readQueryCache,
  writeQueryCache,
  clearQueryCacheKey,
} from "@/db/local/query-cache";

export interface OfflineQueryOptions<T> {
  queryKey: readonly unknown[];
  networkFn: () => Promise<T>;
  /**
   * Mutate-then-return shape before persisting. Use to strip derived
   * fields that must never be synced as authority (CLAUDE.md #2 —
   * balances are derived; persisting them would let an offline UI
   * drift from truth). Pure transform; should not mutate the input.
   */
  beforeCache?: (data: T) => T;
}

function isNetworkError(err: unknown): boolean {
  if (err instanceof ApiClientError) {
    // 5xx and 408 are recoverable — try cache.
    return err.status >= 500 || err.status === 408 || err.status === 0;
  }
  // TypeError from fetch ('Failed to fetch'), AbortError, DOMException
  // — all flag the network as the failure surface.
  return err instanceof TypeError || (err instanceof Error && err.name === "AbortError");
}

function isAuthError(err: unknown): boolean {
  return err instanceof ApiClientError && (err.status === 401 || err.status === 403);
}

export function withOfflineFallback<T>(
  opts: OfflineQueryOptions<T>,
): () => Promise<T> {
  return async () => {
    try {
      const data = await opts.networkFn();
      const toStore = opts.beforeCache ? opts.beforeCache(data) : data;
      void writeQueryCache(opts.queryKey, toStore);
      return data;
    } catch (err) {
      if (isAuthError(err)) {
        void clearQueryCacheKey(opts.queryKey);
        throw err;
      }
      if (isNetworkError(err)) {
        const cached = await readQueryCache<T>(opts.queryKey);
        if (cached !== undefined) return cached;
      }
      throw err;
    }
  };
}
