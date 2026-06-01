import { openLocalDb } from "./schema";
import type { QueryCacheEntry } from "./types";

/**
 * Generic per-query-key blob store. Used by the cache-bridge to keep
 * the last successful response of any read query, so the next offline
 * read can return *something* instead of a network error.
 *
 * Higher-churn collections (transactions, receivables, holdings, …)
 * will graduate to dedicated stores with indexes in a later milestone
 * once the M3 mutation queue needs to mutate them locally.
 */

export function keyOf(queryKey: readonly unknown[]): string {
  return JSON.stringify(queryKey);
}

export async function readQueryCache<T>(queryKey: readonly unknown[]): Promise<T | undefined> {
  try {
    const db = await openLocalDb();
    const entry = await db.get("query_cache", keyOf(queryKey));
    return (entry?.payload as T | undefined) ?? undefined;
  } catch {
    return undefined;
  }
}

export async function writeQueryCache(
  queryKey: readonly unknown[],
  payload: unknown,
): Promise<void> {
  try {
    const db = await openLocalDb();
    const entry: QueryCacheEntry = {
      key: keyOf(queryKey),
      payload,
      fetchedAt: Date.now(),
    };
    await db.put("query_cache", entry);
  } catch {
    /* swallow — cache failures must never break the UI */
  }
}

export async function clearQueryCacheKey(queryKey: readonly unknown[]): Promise<void> {
  try {
    const db = await openLocalDb();
    await db.delete("query_cache", keyOf(queryKey));
  } catch {
    /* ignore */
  }
}

export async function clearAllQueryCache(): Promise<void> {
  try {
    const db = await openLocalDb();
    await db.clear("query_cache");
  } catch {
    /* ignore */
  }
}
