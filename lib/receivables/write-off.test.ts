import { describe, it, expect } from "vitest";
import { WriteOffError, writeOff } from "./write-off";
import type { ReceivableLite, RepaymentLite } from "./types";

function rec(over: Partial<ReceivableLite> = {}): ReceivableLite {
  return {
    _id: "r1",
    counterpartyId: "cp1",
    kind: "cash_loan",
    principalPaise: 100000,
    dateIncurred: "2026-05-01",
    accountId: "acc1",
    dueModel: "none",
    status: "open",
    repaymentTxnIds: [],
    ...over,
  };
}

const NOW = "2026-05-30T12:00:00.000Z";
const ASOF = "2026-05-30";

describe("writeOff — E8 unrecoverable receivable becomes a spend (gift)", () => {
  it("happy path: no repayments → draft amount equals principal", () => {
    const result = writeOff(rec(), [], ASOF, NOW);
    expect(result.compensatingTxnDraft.amountPaise).toBe(100000);
    expect(result.compensatingTxnDraft.flowType).toBe("spend");
    expect(result.compensatingTxnDraft.direction).toBe("out");
    expect(result.compensatingTxnDraft.receivableId).toBe("r1");
    expect(result.compensatingTxnDraft.needWant).toBe("want");
    expect(result.receivableNext.status).toBe("written_off");
    expect(result.receivableNext.closedAt).toBe(NOW);
    expect(result.receivableNext.outstandingPaise).toBe(0);
  });

  it("uses remaining outstanding when partial repayments exist", () => {
    const partial: RepaymentLite[] = [
      { _id: "rp1", receivableId: "r1", valueDate: "2026-05-10", amountPaise: 40000, isDeleted: false, flowType: "lending_repaid" },
    ];
    const result = writeOff(rec(), partial, ASOF, NOW);
    expect(result.compensatingTxnDraft.amountPaise).toBe(60000);
  });

  it("rejects when nothing is outstanding", () => {
    const reps: RepaymentLite[] = [
      { _id: "rp1", receivableId: "r1", valueDate: "2026-05-10", amountPaise: 100000, isDeleted: false, flowType: "lending_repaid" },
    ];
    expect(() => writeOff(rec(), reps, ASOF, NOW)).toThrow(WriteOffError);
  });

  it("rejects when already written_off", () => {
    expect(() => writeOff(rec({ status: "written_off" }), [], ASOF, NOW)).toThrow(WriteOffError);
  });

  it("rejects when receivable has no accountId", () => {
    expect(() => writeOff(rec({ accountId: undefined }), [], ASOF, NOW)).toThrow(WriteOffError);
  });

  it("optionally includes categoryId and notes on the draft", () => {
    const result = writeOff(rec(), [], ASOF, NOW, {
      categoryId: "0".repeat(24),
      notes: "Devanand never paid back",
    });
    expect(result.compensatingTxnDraft.categoryId).toBe("0".repeat(24));
    expect(result.compensatingTxnDraft.notes).toContain("Devanand");
  });
});
