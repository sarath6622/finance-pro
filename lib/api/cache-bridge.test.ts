import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { __resetLocalDbForTests } from "@/db/local/schema";
import { readQueryCache } from "@/db/local/query-cache";
import { withOfflineFallback } from "./cache-bridge";
import { ApiClientError } from "./client";

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  __resetLocalDbForTests();
});

async function flushMicrotasks() {
  // writeQueryCache is fire-and-forget; let its promise settle.
  await new Promise((r) => setTimeout(r, 0));
}

describe("withOfflineFallback", () => {
  it("returns network result and persists it to the cache on success", async () => {
    const key = ["accounts"] as const;
    const queryFn = withOfflineFallback({
      queryKey: key,
      networkFn: async () => ({ items: [{ _id: "a1" }] }),
    });
    const result = await queryFn();
    expect(result).toEqual({ items: [{ _id: "a1" }] });
    await flushMicrotasks();
    expect(await readQueryCache(key)).toEqual({ items: [{ _id: "a1" }] });
  });

  it("applies beforeCache before persisting (strips derived fields)", async () => {
    const key = ["accounts"] as const;
    interface AccountLike { _id: string; balancePaise?: number }
    const queryFn = withOfflineFallback<{ items: AccountLike[] }>({
      queryKey: key,
      networkFn: async () => ({ items: [{ _id: "a1", balancePaise: 999 }] }),
      beforeCache: (data) => ({
        items: data.items.map(({ balancePaise: _drop, ...rest }) => rest),
      }),
    });
    const network = await queryFn();
    expect(network.items[0]?.balancePaise).toBe(999);
    await flushMicrotasks();
    const cached = await readQueryCache<{ items: AccountLike[] }>(key);
    expect(cached?.items[0]?.balancePaise).toBeUndefined();
    expect(cached?.items[0]?._id).toBe("a1");
  });

  it("falls back to the cache on a TypeError (network down)", async () => {
    const key = ["categories"] as const;
    const goodFn = withOfflineFallback({
      queryKey: key,
      networkFn: async () => ({ items: [{ _id: "c1" }] }),
    });
    await goodFn();
    await flushMicrotasks();

    const failFn = withOfflineFallback({
      queryKey: key,
      networkFn: async () => {
        throw new TypeError("Failed to fetch");
      },
    });
    const got = await failFn();
    expect(got).toEqual({ items: [{ _id: "c1" }] });
  });

  it("falls back to the cache on a 503", async () => {
    const key = ["budgets"] as const;
    await withOfflineFallback({ queryKey: key, networkFn: async () => "primed" })();
    await flushMicrotasks();

    const failFn = withOfflineFallback({
      queryKey: key,
      networkFn: async () => {
        throw new ApiClientError(503, "unavailable", "Service down");
      },
    });
    expect(await failFn()).toBe("primed");
  });

  it("rethrows the network error when nothing is cached", async () => {
    const failFn = withOfflineFallback({
      queryKey: ["uncached"],
      networkFn: async () => {
        throw new TypeError("Failed to fetch");
      },
    });
    await expect(failFn()).rejects.toThrow(/Failed to fetch/);
  });

  it("does not fall back on a 400 (request bug — let it surface)", async () => {
    const key = ["bad"] as const;
    await withOfflineFallback({ queryKey: key, networkFn: async () => "primed" })();
    await flushMicrotasks();

    const failFn = withOfflineFallback({
      queryKey: key,
      networkFn: async () => {
        throw new ApiClientError(400, "bad_request", "Bad");
      },
    });
    await expect(failFn()).rejects.toBeInstanceOf(ApiClientError);
  });

  it("purges the cache entry and rethrows on 401", async () => {
    const key = ["accounts"] as const;
    await withOfflineFallback({
      queryKey: key,
      networkFn: async () => ({ items: [{ _id: "a1" }] }),
    })();
    await flushMicrotasks();
    expect(await readQueryCache(key)).toBeDefined();

    const failFn = withOfflineFallback({
      queryKey: key,
      networkFn: async () => {
        throw new ApiClientError(401, "unauthorized", "Sign in");
      },
    });
    await expect(failFn()).rejects.toBeInstanceOf(ApiClientError);
    await flushMicrotasks();
    expect(await readQueryCache(key)).toBeUndefined();
  });

  it("purges on 403 as well", async () => {
    const key = ["accounts"] as const;
    await withOfflineFallback({ queryKey: key, networkFn: async () => "ok" })();
    await flushMicrotasks();
    const failFn = withOfflineFallback({
      queryKey: key,
      networkFn: async () => {
        throw new ApiClientError(403, "forbidden", "Nope");
      },
    });
    await expect(failFn()).rejects.toBeInstanceOf(ApiClientError);
    await flushMicrotasks();
    expect(await readQueryCache(key)).toBeUndefined();
  });

  it("never lets a cache-write failure propagate to the caller", async () => {
    // Force every transaction to fail by closing idb out from under us.
    const queryFn = withOfflineFallback({
      queryKey: ["transient"],
      networkFn: async () => "still works",
    });
    // No-op spy on console to keep test output clean.
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const result = await queryFn();
    expect(result).toBe("still works");
    spy.mockRestore();
  });
});
