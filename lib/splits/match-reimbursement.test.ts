import { describe, expect, it } from "vitest";
import { proposeMatch } from "./match-reimbursement";
import type { ReceivableLite, RepaymentLite } from "@/lib/receivables/types";

function r(
  id: string,
  principal: number,
  date: string,
  status: ReceivableLite["status"] = "open",
  kind: ReceivableLite["kind"] = "split_iou",
  splitId?: string,
): ReceivableLite {
  return {
    _id: id,
    counterpartyId: "cp1",
    kind,
    principalPaise: principal,
    dateIncurred: date,
    dueModel: "when_able",
    status,
    repaymentTxnIds: [],
    ...(splitId ? { splitId } : {}),
  };
}

function rep(id: string, recId: string, amount: number): RepaymentLite {
  return {
    _id: id,
    receivableId: recId,
    valueDate: "2026-05-01",
    amountPaise: amount,
    isDeleted: false,
    flowType: "reimbursement_in",
  };
}

describe("proposeMatch", () => {
  it("returns undefined when no open split IOUs", () => {
    expect(proposeMatch([], new Map())).toBeUndefined();
  });
  it("ignores cash_loan kind", () => {
    const recs = [r("rec1", 50000, "2026-05-01", "open", "cash_loan")];
    expect(proposeMatch(recs, new Map())).toBeUndefined();
  });
  it("ignores closed/written_off", () => {
    const recs = [
      r("rec1", 50000, "2026-05-01", "closed"),
      r("rec2", 80000, "2026-05-02", "written_off"),
    ];
    expect(proposeMatch(recs, new Map())).toBeUndefined();
  });
  it("ignores soft-deleted", () => {
    const recs = [{ ...r("rec1", 50000, "2026-05-01"), isDeleted: true }];
    expect(proposeMatch(recs, new Map())).toBeUndefined();
  });
  it("returns the largest outstanding receivable", () => {
    const recs = [
      r("rec1", 50000, "2026-05-01"),
      r("rec2", 80000, "2026-05-02"),
      r("rec3", 30000, "2026-05-03"),
    ];
    const out = proposeMatch(recs, new Map());
    expect(out?.receivableId).toBe("rec2");
    expect(out?.outstandingPaise).toBe(80000);
  });
  it("breaks ties on earliest dateIncurred", () => {
    const recs = [
      r("rec1", 50000, "2026-05-10"),
      r("rec2", 50000, "2026-05-02"),
    ];
    const out = proposeMatch(recs, new Map());
    expect(out?.receivableId).toBe("rec2");
  });
  it("uses outstanding (post-repayment) not principal for ranking", () => {
    const recs = [
      r("rec1", 100000, "2026-05-01", "partial"),
      r("rec2", 80000, "2026-05-02"),
    ];
    const reps = new Map<string, RepaymentLite[]>([
      ["rec1", [rep("r1a", "rec1", 90000)]], // outstanding = 10000
    ]);
    const out = proposeMatch(recs, reps);
    expect(out?.receivableId).toBe("rec2");
  });
  it("skips zero-outstanding receivables even if status not yet closed", () => {
    const recs = [r("rec1", 50000, "2026-05-01")];
    const reps = new Map<string, RepaymentLite[]>([
      ["rec1", [rep("r1a", "rec1", 50000)]],
    ]);
    expect(proposeMatch(recs, reps)).toBeUndefined();
  });
  it("preserves splitId in the proposal", () => {
    const recs = [r("rec1", 50000, "2026-05-01", "open", "split_iou", "sb-xyz")];
    expect(proposeMatch(recs, new Map())?.splitId).toBe("sb-xyz");
  });
});
