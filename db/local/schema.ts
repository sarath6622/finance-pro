import { openDB, type IDBPDatabase, type DBSchema } from "idb";
import type { LocalStoreName, QueryCacheEntry } from "./types";

export const LOCAL_DB_NAME = "finance-tracker";
export const LOCAL_DB_VERSION = 1;

/**
 * Strict idb schema. Records are stored as opaque blobs of `unknown`
 * under their canonical `_id` (or `key` for `query_cache`) — the cache
 * bridge owns shape validation when handing data back to TanStack.
 */
export interface LocalDbSchema extends DBSchema {
  transactions: { key: string; value: { _id: string } & Record<string, unknown>; indexes: { byValueDate: string; byAccount: string } };
  accounts: { key: string; value: { _id: string } & Record<string, unknown> };
  categories: { key: string; value: { _id: string } & Record<string, unknown> };
  counterparties: { key: string; value: { _id: string } & Record<string, unknown> };
  receivables: { key: string; value: { _id: string } & Record<string, unknown> };
  split_bills: { key: string; value: { _id: string } & Record<string, unknown> };
  holdings: { key: string; value: { _id: string } & Record<string, unknown> };
  budgets: { key: string; value: { _id: string } & Record<string, unknown>; indexes: { byMonth: string } };
  recurring_rules: { key: string; value: { _id: string } & Record<string, unknown> };
  settings: { key: string; value: { _id: string } & Record<string, unknown> };
  query_cache: { key: string; value: QueryCacheEntry };
}

let cached: Promise<IDBPDatabase<LocalDbSchema>> | null = null;

/**
 * Open (and memoize) the local idb. Browser-only.
 *
 * Schema upgrades land here as isolated `if (oldVersion < N)` blocks —
 * each one runs once per client and must never be reordered. Bumping
 * `LOCAL_DB_VERSION` triggers the upgrade path on next open.
 */
export function openLocalDb(): Promise<IDBPDatabase<LocalDbSchema>> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is not available in this environment"));
  }
  if (!cached) {
    cached = openDB<LocalDbSchema>(LOCAL_DB_NAME, LOCAL_DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const txns = db.createObjectStore("transactions", { keyPath: "_id" });
          txns.createIndex("byValueDate", "valueDate");
          txns.createIndex("byAccount", "accountId");

          db.createObjectStore("accounts", { keyPath: "_id" });
          db.createObjectStore("categories", { keyPath: "_id" });
          db.createObjectStore("counterparties", { keyPath: "_id" });
          db.createObjectStore("receivables", { keyPath: "_id" });
          db.createObjectStore("split_bills", { keyPath: "_id" });
          db.createObjectStore("holdings", { keyPath: "_id" });

          const budgets = db.createObjectStore("budgets", { keyPath: "_id" });
          budgets.createIndex("byMonth", "month");

          db.createObjectStore("recurring_rules", { keyPath: "_id" });
          db.createObjectStore("settings", { keyPath: "_id" });
          db.createObjectStore("query_cache", { keyPath: "key" });
        }
      },
    });
  }
  return cached;
}

/** Test-only — resets the memoized handle so each test gets a fresh DB. */
export function __resetLocalDbForTests(): void {
  cached = null;
}

export const LOCAL_STORE_NAMES: readonly LocalStoreName[] = [
  "transactions",
  "accounts",
  "categories",
  "counterparties",
  "receivables",
  "split_bills",
  "holdings",
  "budgets",
  "recurring_rules",
  "settings",
  "query_cache",
] as const;
