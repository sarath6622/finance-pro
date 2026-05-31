import { describe, it, expect } from "vitest";
import {
  isActiveTxn,
  isOnOrAfterOpening,
  isSplitParentContainer,
  isWithinCutoff,
  liveChildrenByParent,
} from "./filters";
import { mkTxn } from "@/lib/test-utils/fixtures";

describe("filters — soft-delete + cutoff + opening date", () => {
  it("isActiveTxn excludes soft-deleted", () => {
    expect(isActiveTxn(mkTxn({ accountId: "a", isDeleted: false }))).toBe(true);
    expect(isActiveTxn(mkTxn({ accountId: "a", isDeleted: true }))).toBe(false);
  });

  it("isWithinCutoff is inclusive (E19 — uses valueDate)", () => {
    const txn = mkTxn({ accountId: "a", valueDate: "2026-05-30" });
    expect(isWithinCutoff(txn, "2026-05-30")).toBe(true);
    expect(isWithinCutoff(txn, "2026-05-31")).toBe(true);
    expect(isWithinCutoff(txn, "2026-05-29")).toBe(false);
    expect(isWithinCutoff(txn, undefined)).toBe(true);
  });

  it("isOnOrAfterOpening (E23)", () => {
    const txn = mkTxn({ accountId: "a", valueDate: "2026-04-01" });
    expect(isOnOrAfterOpening(txn, "2026-04-01")).toBe(true);
    expect(isOnOrAfterOpening(txn, "2026-04-02")).toBe(false);
    expect(isOnOrAfterOpening(txn, "2026-03-31")).toBe(true);
    expect(isOnOrAfterOpening(txn, undefined)).toBe(true);
  });

  it("isOnOrAfterOpening tolerates ISO timestamps in openingDate", () => {
    const txn = mkTxn({ accountId: "a", valueDate: "2026-04-01" });
    expect(isOnOrAfterOpening(txn, "2026-04-01T12:00:00.000Z")).toBe(true);
  });
});

describe("liveChildrenByParent + isSplitParentContainer (E1)", () => {
  it("groups live children by parentId; ignores deleted", () => {
    const parent = mkTxn({ accountId: "a", _id: "p1", amountPaise: 60000 });
    const c1 = mkTxn({ accountId: "a", parentTransactionId: "p1", amountPaise: 25000 });
    const c2 = mkTxn({ accountId: "a", parentTransactionId: "p1", amountPaise: 35000 });
    const cDead = mkTxn({
      accountId: "a",
      parentTransactionId: "p1",
      amountPaise: 10000,
      isDeleted: true,
    });
    const map = liveChildrenByParent([parent, c1, c2, cDead]);
    expect(map.get("p1")?.length).toBe(2);
    expect(isSplitParentContainer(parent, map)).toBe(true);
  });

  it("parent re-enters totals when all children are deleted", () => {
    const parent = mkTxn({ accountId: "a", _id: "p2" });
    const c = mkTxn({
      accountId: "a",
      parentTransactionId: "p2",
      isDeleted: true,
    });
    const map = liveChildrenByParent([parent, c]);
    expect(isSplitParentContainer(parent, map)).toBe(false);
  });
});
