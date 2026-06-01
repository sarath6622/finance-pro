import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { __resetLocalDbForTests } from "./schema";
import {
  clearAllQueryCache,
  clearQueryCacheKey,
  keyOf,
  readQueryCache,
  writeQueryCache,
} from "./query-cache";

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  __resetLocalDbForTests();
});

describe("query-cache", () => {
  it("keyOf is order-sensitive and produces stable JSON", () => {
    expect(keyOf(["accounts", { a: 1, b: 2 }])).toBe(keyOf(["accounts", { a: 1, b: 2 }]));
    expect(keyOf(["accounts", { a: 1 }])).not.toBe(keyOf(["accounts", { a: 2 }]));
  });

  it("returns undefined when no entry exists for the key", async () => {
    const got = await readQueryCache(["accounts", { includeInactive: false }]);
    expect(got).toBeUndefined();
  });

  it("round-trips a payload through write → read", async () => {
    const key = ["accounts", { includeInactive: false }] as const;
    await writeQueryCache(key, { items: [{ _id: "a1", name: "HDFC" }] });
    const got = await readQueryCache<{ items: Array<{ _id: string }> }>(key);
    expect(got?.items[0]?._id).toBe("a1");
  });

  it("overwrites a previous payload at the same key", async () => {
    const key = ["categories"] as const;
    await writeQueryCache(key, { items: [{ _id: "c1" }] });
    await writeQueryCache(key, { items: [{ _id: "c2" }] });
    const got = await readQueryCache<{ items: Array<{ _id: string }> }>(key);
    expect(got?.items[0]?._id).toBe("c2");
  });

  it("clearQueryCacheKey removes a single entry", async () => {
    const a = ["a"] as const;
    const b = ["b"] as const;
    await writeQueryCache(a, 1);
    await writeQueryCache(b, 2);
    await clearQueryCacheKey(a);
    expect(await readQueryCache(a)).toBeUndefined();
    expect(await readQueryCache(b)).toBe(2);
  });

  it("clearAllQueryCache wipes everything", async () => {
    await writeQueryCache(["x"], 1);
    await writeQueryCache(["y"], 2);
    await clearAllQueryCache();
    expect(await readQueryCache(["x"])).toBeUndefined();
    expect(await readQueryCache(["y"])).toBeUndefined();
  });
});
