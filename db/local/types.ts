/**
 * Local mirror types for the IndexedDB cache that backs offline reads.
 *
 * Every persisted record carries a small envelope so the cache layer
 * can reason about freshness independently of the wrapped server shape.
 */

export interface LocalRecordMeta {
  /** ms epoch — when this record was last written to idb. */
  _localUpdatedAt: number;
  /** Origin marker — server snapshot or an M3-stage optimistic write. */
  _origin: "server" | "local-optimistic";
}

export type LocalRecord<T> = T & LocalRecordMeta;

/**
 * Names of the idb object stores. Keep in sync with `db/local/schema.ts`.
 * Listed as the canonical source of truth so other modules import the
 * union and get a compile error if a store is added/removed.
 */
export type LocalStoreName =
  | "transactions"
  | "accounts"
  | "categories"
  | "counterparties"
  | "receivables"
  | "split_bills"
  | "holdings"
  | "budgets"
  | "recurring_rules"
  | "settings"
  | "query_cache";

/**
 * Generic per-query response cache. Used by the cache-bridge for
 * filter/paginated reads (M2). Higher-volume entities migrate to
 * dedicated stores in later milestones.
 */
export interface QueryCacheEntry {
  /** Canonical, JSON-stringified queryKey. */
  key: string;
  /** Whatever the queryFn returned, untouched. */
  payload: unknown;
  /** Server timestamp at write. */
  fetchedAt: number;
}
