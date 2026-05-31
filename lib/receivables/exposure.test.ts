import { describe, it, expect } from "vitest";
import { groupByCounterparty, summarizeExposure } from "./exposure";
import type { ReceivableLite, RepaymentLite } from "./types";

function rec(over: Partial<ReceivableLite> & { _id: string; counterpartyId: string }): ReceivableLite {
  return {
    kind: "cash_loan",
    principalPaise: 10000,
    dateIncurred: "2026-05-01",
    dueModel: "none",
    status: "open",
    repaymentTxnIds: [],
    ...over,
  };
}

const NO_REPS = new Map<string, RepaymentLite[]>();
const ASOF = "2026-05-30";

describe("summarizeExposure — R14 reconciliation (FR-15)", () => {
  it("totals.outstandingPaise === sum of perCounterparty totals", () => {
    const receivables = [
      rec({ _id: "r1", counterpartyId: "alice", principalPaise: 50000 }),
      rec({ _id: "r2", counterpartyId: "bob", principalPaise: 30000 }),
      rec({ _id: "r3", counterpartyId: "alice", kind: "split_iou", principalPaise: 12000 }),
    ];
    const r = summarizeExposure(receivables, NO_REPS, ASOF);
    expect(r.totals.outstandingPaise).toBe(92000);
    expect(
      r.perCounterparty.reduce((s, c) => s + c.totalOutstandingPaise, 0),
    ).toBe(92000);
  });

  it("cashLoanPaise + splitIouPaise === outstandingPaise", () => {
    const receivables = [
      rec({ _id: "r1", counterpartyId: "a", kind: "cash_loan", principalPaise: 50000 }),
      rec({ _id: "r2", counterpartyId: "b", kind: "split_iou", principalPaise: 20000 }),
    ];
    const r = summarizeExposure(receivables, NO_REPS, ASOF);
    expect(r.totals.cashLoanPaise + r.totals.splitIouPaise).toBe(r.totals.outstandingPaise);
  });

  it("excludes written_off and soft-deleted by default", () => {
    const receivables = [
      rec({ _id: "r1", counterpartyId: "a", principalPaise: 50000 }),
      rec({ _id: "r2", counterpartyId: "a", principalPaise: 99999, status: "written_off" }),
      rec({ _id: "r3", counterpartyId: "a", principalPaise: 88888, isDeleted: true }),
    ];
    const r = summarizeExposure(receivables, NO_REPS, ASOF);
    expect(r.totals.outstandingPaise).toBe(50000);
  });

  it("pay-when-able outstanding feeds payWhenAblePaise, not byBucket['90+']", () => {
    const receivables = [
      rec({
        _id: "r1",
        counterpartyId: "alice",
        principalPaise: 9800,
        dueModel: "when_able",
        dateIncurred: "2024-01-01",
      }),
    ];
    const r = summarizeExposure(receivables, NO_REPS, ASOF);
    expect(r.totals.payWhenAblePaise).toBe(9800);
    expect(r.totals.byBucket["90+"]).toBe(0);
    expect(r.totals.hasPayWhenAble).toBe(true);
  });

  it("two receivables to same counterparty fold into one CounterpartyExposure", () => {
    const receivables = [
      rec({ _id: "r1", counterpartyId: "x", principalPaise: 50000 }),
      rec({ _id: "r2", counterpartyId: "x", principalPaise: 25000 }),
    ];
    const groups = groupByCounterparty(receivables, NO_REPS, ASOF);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.totalOutstandingPaise).toBe(75000);
    expect(groups[0]!.receivableIds).toEqual(expect.arrayContaining(["r1", "r2"]));
  });

  it("skips receivables fully repaid", () => {
    const receivables = [rec({ _id: "r1", counterpartyId: "a", principalPaise: 10000 })];
    const reps = new Map<string, RepaymentLite[]>([
      [
        "r1",
        [
          {
            _id: "rp1",
            receivableId: "r1",
            valueDate: "2026-05-15",
            amountPaise: 10000,
            isDeleted: false,
            flowType: "lending_repaid",
          },
        ],
      ],
    ]);
    const r = summarizeExposure(receivables, reps, ASOF);
    expect(r.totals.outstandingPaise).toBe(0);
    expect(r.perCounterparty).toHaveLength(0);
  });

  it("counterpartyCount reflects active groups only", () => {
    const receivables = [
      rec({ _id: "r1", counterpartyId: "a", principalPaise: 10000 }),
      rec({ _id: "r2", counterpartyId: "b", principalPaise: 20000 }),
    ];
    const r = summarizeExposure(receivables, NO_REPS, ASOF);
    expect(r.totals.counterpartyCount).toBe(2);
  });

  it("perCounterparty sorted by total outstanding desc", () => {
    const receivables = [
      rec({ _id: "r1", counterpartyId: "small", principalPaise: 10000 }),
      rec({ _id: "r2", counterpartyId: "big", principalPaise: 100000 }),
      rec({ _id: "r3", counterpartyId: "mid", principalPaise: 50000 }),
    ];
    const r = summarizeExposure(receivables, NO_REPS, ASOF);
    expect(r.perCounterparty.map((c) => c.counterpartyId)).toEqual(["big", "mid", "small"]);
  });
});
