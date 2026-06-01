import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import {
  LOCAL_DB_NAME,
  LOCAL_DB_VERSION,
  LOCAL_STORE_NAMES,
  __resetLocalDbForTests,
  openLocalDb,
} from "./schema";

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  __resetLocalDbForTests();
});

afterEach(() => {
  __resetLocalDbForTests();
});

describe("openLocalDb", () => {
  it(`opens the local db at name=${LOCAL_DB_NAME} and version=${LOCAL_DB_VERSION}`, async () => {
    const db = await openLocalDb();
    expect(db.name).toBe(LOCAL_DB_NAME);
    expect(db.version).toBe(LOCAL_DB_VERSION);
  });

  it("creates every store enumerated in LOCAL_STORE_NAMES", async () => {
    const db = await openLocalDb();
    for (const name of LOCAL_STORE_NAMES) {
      expect(Array.from(db.objectStoreNames)).toContain(name);
    }
  });

  it("uses _id as the keyPath on entity stores", async () => {
    const db = await openLocalDb();
    const txn = db.transaction("transactions");
    expect(txn.store.keyPath).toBe("_id");
  });

  it("uses key as the keyPath on query_cache", async () => {
    const db = await openLocalDb();
    const txn = db.transaction("query_cache");
    expect(txn.store.keyPath).toBe("key");
  });

  it("indexes transactions by valueDate and accountId", async () => {
    const db = await openLocalDb();
    const txn = db.transaction("transactions");
    expect(Array.from(txn.store.indexNames)).toEqual(
      expect.arrayContaining(["byValueDate", "byAccount"]),
    );
  });

  it("indexes budgets by month", async () => {
    const db = await openLocalDb();
    const txn = db.transaction("budgets");
    expect(Array.from(txn.store.indexNames)).toContain("byMonth");
  });

  it("memoizes the database handle between calls", async () => {
    const a = await openLocalDb();
    const b = await openLocalDb();
    expect(b).toBe(a);
  });

  it("returns a fresh handle after __resetLocalDbForTests()", async () => {
    const a = await openLocalDb();
    __resetLocalDbForTests();
    a.close();
    globalThis.indexedDB = new IDBFactory();
    const b = await openLocalDb();
    expect(b).not.toBe(a);
  });

  it("round-trips a record through put + get", async () => {
    const db = await openLocalDb();
    await db.put("accounts", { _id: "a1", name: "HDFC Bank", kind: "bank" });
    const got = await db.get("accounts", "a1");
    expect(got).toMatchObject({ _id: "a1", name: "HDFC Bank" });
  });

  it("rejects when indexedDB is unavailable", async () => {
    const original = globalThis.indexedDB;
    // @ts-expect-error — runtime delete for the negative test
    delete globalThis.indexedDB;
    __resetLocalDbForTests();
    await expect(openLocalDb()).rejects.toThrow(/IndexedDB/);
    globalThis.indexedDB = original;
  });
});
