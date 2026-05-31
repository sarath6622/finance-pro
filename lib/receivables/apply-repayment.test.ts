import { describe, it, expect } from "vitest";
import {
  ReceivableWriteOffError,
  applyRepayment,
  computeOutstanding,
  recomputeReceivableState,
} from "./apply-repayment";
import type { ReceivableLite, RepaymentLite } from "./types";

function mkReceivable(over: Partial<ReceivableLite> = {}): ReceivableLite {
  return {
    _id: "r1",
    counterpartyId: "cp1",
    kind: "cash_loan",
    principalPaise: 100000,
    dateIncurred: "2026-05-01",
    accountId: "acc1",
    dueModel: "when_able",
    status: "open",
    repaymentTxnIds: [],
    ...over,
  };
}

function mkRepayment(over: Partial<RepaymentLite> & { _id: string }): RepaymentLite {
  return {
    valueDate: "2026-05-15",
    amountPaise: 50000,
    isDeleted: false,
    flowType: "lending_repaid",
    receivableId: "r1",
    ...over,
  };
}

const NOW = "2026-05-30T12:00:00.000Z";

describe("computeOutstanding", () => {
  it("subtracts live repayments from principal", () => {
    const r = mkReceivable({ principalPaise: 100000 });
    const reps = [mkRepayment({ _id: "rp1", amountPaise: 30000 }), mkRepayment({ _id: "rp2", amountPaise: 20000 })];
    expect(computeOutstanding(r, reps)).toEqual({ outstandingPaise: 50000, overpaymentPaise: 0 });
  });
  it("ignores soft-deleted repayments", () => {
    const r = mkReceivable({ principalPaise: 100000 });
    const reps = [
      mkRepayment({ _id: "rp1", amountPaise: 30000 }),
      mkRepayment({ _id: "rp2", amountPaise: 999999, isDeleted: true }),
    ];
    expect(computeOutstanding(r, reps).outstandingPaise).toBe(70000);
  });
  it("never returns negative outstanding (E28 overpayment surfaces separately)", () => {
    const r = mkReceivable({ principalPaise: 50000 });
    const reps = [mkRepayment({ _id: "rp1", amountPaise: 70000 })];
    expect(computeOutstanding(r, reps)).toEqual({ outstandingPaise: 0, overpaymentPaise: 20000 });
  });
});

describe("applyRepayment", () => {
  it("E6 same-day full repayment closes the receivable", () => {
    const r = mkReceivable({ principalPaise: 50000, dateIncurred: "2026-05-30" });
    const repayment = mkRepayment({ _id: "rp1", amountPaise: 50000, valueDate: "2026-05-30" });
    const next = applyRepayment(r, repayment, [], NOW);
    expect(next.status).toBe("closed");
    expect(next.outstandingPaise).toBe(0);
    expect(next.closedAt).toBe(NOW);
    expect(next.overpaymentPaise).toBe(0);
    expect(next.repaymentTxnIds).toContain("rp1");
  });

  it("E7 three partial repayments transition open → partial → partial → closed", () => {
    const r = mkReceivable({ principalPaise: 100000 });
    const rp1 = mkRepayment({ _id: "rp1", amountPaise: 30000 });
    const rp2 = mkRepayment({ _id: "rp2", amountPaise: 40000 });
    const rp3 = mkRepayment({ _id: "rp3", amountPaise: 30000 });
    const afterRp1 = applyRepayment(r, rp1, [], NOW);
    expect(afterRp1.status).toBe("partial");
    expect(afterRp1.outstandingPaise).toBe(70000);
    const afterRp2 = applyRepayment(r, rp2, [rp1], NOW);
    expect(afterRp2.status).toBe("partial");
    expect(afterRp2.outstandingPaise).toBe(30000);
    const afterRp3 = applyRepayment(r, rp3, [rp1, rp2], NOW);
    expect(afterRp3.status).toBe("closed");
    expect(afterRp3.outstandingPaise).toBe(0);
  });

  it("ordering insensitivity for partial repayments", () => {
    const r = mkReceivable({ principalPaise: 100000 });
    const rp1 = mkRepayment({ _id: "rp1", amountPaise: 30000 });
    const rp2 = mkRepayment({ _id: "rp2", amountPaise: 40000 });
    const rp3 = mkRepayment({ _id: "rp3", amountPaise: 30000 });
    const a = applyRepayment(r, rp3, [rp1, rp2], NOW);
    const b = applyRepayment(r, rp1, [rp3, rp2], NOW);
    expect(a.status).toBe(b.status);
    expect(a.outstandingPaise).toBe(b.outstandingPaise);
  });

  it("E27 cross-period repayment still closes", () => {
    const r = mkReceivable({ principalPaise: 50000, dateIncurred: "2026-03-01" });
    const rp = mkRepayment({ _id: "rp1", amountPaise: 50000, valueDate: "2026-05-15" });
    const next = applyRepayment(r, rp, [], NOW);
    expect(next.status).toBe("closed");
  });

  it("E28 overpayment leaves outstanding=0 and surfaces excess", () => {
    const r = mkReceivable({ principalPaise: 50000 });
    const rp = mkRepayment({ _id: "rp1", amountPaise: 70000 });
    const next = applyRepayment(r, rp, [], NOW);
    expect(next.status).toBe("closed");
    expect(next.outstandingPaise).toBe(0);
    expect(next.overpaymentPaise).toBe(20000);
  });

  it("E28 overpayment via multiple repayments", () => {
    const r = mkReceivable({ principalPaise: 50000 });
    const rp1 = mkRepayment({ _id: "rp1", amountPaise: 30000 });
    const rp2 = mkRepayment({ _id: "rp2", amountPaise: 40000 });
    const after = applyRepayment(r, rp2, [rp1], NOW);
    expect(after.outstandingPaise).toBe(0);
    expect(after.overpaymentPaise).toBe(20000);
  });

  it("rejects repayment on a written_off receivable", () => {
    const r = mkReceivable({ status: "written_off" });
    expect(() =>
      applyRepayment(r, mkRepayment({ _id: "rp1" }), [], NOW),
    ).toThrow(ReceivableWriteOffError);
  });

  it("rejects zero or negative amounts", () => {
    const r = mkReceivable();
    expect(() =>
      applyRepayment(r, mkRepayment({ _id: "rp1", amountPaise: 0 }), [], NOW),
    ).toThrow();
    expect(() =>
      applyRepayment(r, mkRepayment({ _id: "rp1", amountPaise: -10 }), [], NOW),
    ).toThrow();
  });

  it("idempotent: applying same repayment id twice doesn't double-count repaymentTxnIds", () => {
    const r = mkReceivable({ principalPaise: 100000, repaymentTxnIds: ["rp1"] });
    const rp = mkRepayment({ _id: "rp1", amountPaise: 30000 });
    const next = applyRepayment(r, rp, [rp], NOW);
    expect(next.repaymentTxnIds.filter((id) => id === "rp1")).toHaveLength(1);
  });
});

describe("recomputeReceivableState — cascade reopen on delete", () => {
  it("returns 'open' with full principal when all repayments deleted", () => {
    const r = mkReceivable({ principalPaise: 100000, repaymentTxnIds: [] });
    const state = recomputeReceivableState(r, [], NOW);
    expect(state.status).toBe("open");
    expect(state.outstandingPaise).toBe(100000);
  });

  it("transitions closed → partial when a repayment is removed", () => {
    const r = mkReceivable({ principalPaise: 100000, repaymentTxnIds: ["rp1", "rp2"] });
    const reps = [mkRepayment({ _id: "rp1", amountPaise: 40000 })];
    const state = recomputeReceivableState(r, reps, NOW);
    expect(state.status).toBe("partial");
    expect(state.outstandingPaise).toBe(60000);
  });

  it("preserves status when receivable is written_off", () => {
    const r = mkReceivable({ status: "written_off" });
    const state = recomputeReceivableState(r, [], NOW);
    expect(state.status).toBe("written_off");
  });
});
