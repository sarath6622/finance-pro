import { beforeEach, describe, expect, it } from "vitest";
import { runningBalancesFromAnchor } from "./compute";
import { mkAccount, mkTxn, resetOidCounter } from "@/lib/test-utils/fixtures";

beforeEach(() => {
  resetOidCounter();
});

describe("runningBalancesFromAnchor", () => {
  it("returns the anchor for a single-row list", () => {
    const acc = mkAccount({ openingBalancePaise: 0 });
    const t = mkTxn({ accountId: acc._id, amountPaise: 100000, direction: "out" });
    const out = runningBalancesFromAnchor([t], -100000, acc);
    expect(out.get(t._id)).toBe(-100000);
  });

  it("walks descending order, subtracting each delta to derive older balances", () => {
    const acc = mkAccount({ openingBalancePaise: 0 });
    // Chronological: A=+1000, B=-200, C=-100. Display order (desc): C, B, A.
    const a = mkTxn({ accountId: acc._id, _id: "a", amountPaise: 100000, direction: "in" });
    const b = mkTxn({ accountId: acc._id, _id: "b", amountPaise: 20000, direction: "out" });
    const c = mkTxn({ accountId: acc._id, _id: "c", amountPaise: 10000, direction: "out" });
    const current = 100000 - 20000 - 10000; // = 70000
    const out = runningBalancesFromAnchor([c, b, a], current, acc);
    expect(out.get("c")).toBe(70000);
    expect(out.get("b")).toBe(80000);
    expect(out.get("a")).toBe(100000);
  });

  it("skips soft-deleted txns (no entry, no delta applied)", () => {
    const acc = mkAccount();
    const a = mkTxn({ accountId: acc._id, _id: "a", amountPaise: 50000, direction: "in" });
    const b = mkTxn({
      accountId: acc._id,
      _id: "b",
      amountPaise: 99999,
      direction: "out",
      isDeleted: true,
    });
    const c = mkTxn({ accountId: acc._id, _id: "c", amountPaise: 10000, direction: "out" });
    // Real balance contribution: +500, -100 → 40000 net. b ignored.
    const out = runningBalancesFromAnchor([c, b, a], 40000, acc);
    expect(out.get("c")).toBe(40000);
    expect(out.has("b")).toBe(false);
    expect(out.get("a")).toBe(50000);
  });

  it("skips split-parent containers and counts only their children", () => {
    const acc = mkAccount();
    const parent = mkTxn({
      accountId: acc._id,
      _id: "p",
      amountPaise: 60000,
      direction: "out",
    });
    const child1 = mkTxn({
      accountId: acc._id,
      _id: "c1",
      parentTransactionId: "p",
      amountPaise: 25000,
      direction: "out",
    });
    const child2 = mkTxn({
      accountId: acc._id,
      _id: "c2",
      parentTransactionId: "p",
      amountPaise: 35000,
      direction: "out",
    });
    // Children sum to 60000 → balance change = -60000. Parent skipped.
    const out = runningBalancesFromAnchor([parent, child1, child2], -60000, acc);
    expect(out.has("p")).toBe(false);
    expect(out.get("c1")).toBe(-60000);
    expect(out.get("c2")).toBe(-35000);
  });

  it("handles a mix of in and out flows", () => {
    const acc = mkAccount();
    // Chronological: salary +50k, rent -20k, refund +5k, fuel -200.
    const salary = mkTxn({
      accountId: acc._id,
      _id: "salary",
      amountPaise: 5000000,
      direction: "in",
    });
    const rent = mkTxn({
      accountId: acc._id,
      _id: "rent",
      amountPaise: 2000000,
      direction: "out",
    });
    const refund = mkTxn({
      accountId: acc._id,
      _id: "refund",
      amountPaise: 500000,
      direction: "in",
    });
    const fuel = mkTxn({
      accountId: acc._id,
      _id: "fuel",
      amountPaise: 20000,
      direction: "out",
    });
    const current = 5000000 - 2000000 + 500000 - 20000; // 3480000
    const desc = [fuel, refund, rent, salary];
    const out = runningBalancesFromAnchor(desc, current, acc);
    expect(out.get("fuel")).toBe(3480000);
    expect(out.get("refund")).toBe(3500000);
    expect(out.get("rent")).toBe(3000000);
    expect(out.get("salary")).toBe(5000000);
  });

  it("returns an empty map for an empty list", () => {
    const acc = mkAccount({ openingBalancePaise: 12345 });
    expect(runningBalancesFromAnchor([], 12345, acc).size).toBe(0);
  });

  it("works for a liability account (positive balance = amount owed)", () => {
    // Credit card with opening 0; spend ₹10k brings balance to -10000 (asset
    // perspective). The compute function uses signed deltas based on direction
    // — we only test that math here, not the classification semantics.
    const card = mkAccount({ classification: "liability" });
    const charge = mkTxn({
      accountId: card._id,
      _id: "chg",
      amountPaise: 1000000,
      direction: "out",
      flowType: "spend",
    });
    const payment = mkTxn({
      accountId: card._id,
      _id: "pay",
      amountPaise: 500000,
      direction: "in",
      flowType: "card_settlement",
    });
    // Net: -1000000 + 500000 = -500000.
    const out = runningBalancesFromAnchor([payment, charge], -500000, card);
    expect(out.get("pay")).toBe(-500000);
    expect(out.get("chg")).toBe(-1000000);
  });
});
