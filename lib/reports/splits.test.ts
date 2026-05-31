import { describe, expect, it } from "vitest";
import { buildR15 } from "./splits";
import type { ReceivableLite, RepaymentLite } from "@/lib/receivables/types";
import type { SplitBillLite } from "@/lib/splits/types";

function rec(
  id: string,
  principal: number,
  status: ReceivableLite["status"] = "open",
  splitId?: string,
): ReceivableLite {
  return {
    _id: id,
    counterpartyId: "cp",
    kind: "split_iou",
    principalPaise: principal,
    dateIncurred: "2026-05-01",
    dueModel: "when_able",
    status,
    repaymentTxnIds: [],
    ...(splitId ? { splitId } : {}),
  };
}

function bill(
  id: string,
  total: number,
  ownShare: number,
  participants: { sharePaise: number; settledPaise: number; receivableId: string }[],
  status: SplitBillLite["status"] = "open",
  createdAt = "2026-05-01T10:00:00Z",
): SplitBillLite {
  return {
    _id: id,
    sourceTransactionId: "txn-" + id,
    totalPaise: total,
    payerAccountId: "acc1",
    ownSharePaise: ownShare,
    status,
    createdAt,
    participants: participants.map((p, i) => ({
      counterpartyId: "cp" + (i + 1),
      sharePaise: p.sharePaise,
      settledPaise: p.settledPaise,
      status:
        p.settledPaise <= 0
          ? "open"
          : p.settledPaise >= p.sharePaise
            ? "settled"
            : "partial",
      dueModel: "when_able",
      receivableId: p.receivableId,
    })),
  };
}

describe("buildR15", () => {
  it("aggregates open/partial/settled bills", () => {
    const b1 = bill("b1", 120000, 30000, [
      { sharePaise: 30000, settledPaise: 0, receivableId: "r1a" },
      { sharePaise: 30000, settledPaise: 0, receivableId: "r1b" },
      { sharePaise: 30000, settledPaise: 0, receivableId: "r1c" },
    ]);
    const b2 = bill(
      "b2",
      100000,
      0,
      [{ sharePaise: 100000, settledPaise: 100000, receivableId: "r2a" }],
      "settled",
    );
    const recs: ReceivableLite[] = [
      rec("r1a", 30000),
      rec("r1b", 30000),
      rec("r1c", 30000),
      rec("r2a", 100000, "closed"),
    ];
    const reps = new Map<string, RepaymentLite[]>([
      [
        "r2a",
        [
          {
            _id: "rep1",
            receivableId: "r2a",
            valueDate: "2026-05-10",
            amountPaise: 100000,
            isDeleted: false,
            flowType: "reimbursement_in",
          },
        ],
      ],
    ]);
    const out = buildR15([b1, b2], recs, reps, "2026-05-30");
    expect(out.totals.bills).toBe(2);
    expect(out.totals.openCount).toBe(1);
    expect(out.totals.settledCount).toBe(1);
    expect(out.totals.outstandingPaise).toBe(90000);
    expect(out.buckets.open.outstandingPaise).toBe(90000);
    expect(out.buckets.settled.outstandingPaise).toBe(0);
  });

  it("counts written_off receivables as settled toward the bill (owner absorbed via compensating spend)", () => {
    const b = bill(
      "b1",
      60000,
      0,
      [
        { sharePaise: 30000, settledPaise: 30000, receivableId: "r1a" },
        { sharePaise: 30000, settledPaise: 0, receivableId: "r1b" },
      ],
      "partial",
    );
    const recs: ReceivableLite[] = [
      rec("r1a", 30000, "closed"),
      rec("r1b", 30000, "written_off"),
    ];
    const reps = new Map<string, RepaymentLite[]>([
      [
        "r1a",
        [
          {
            _id: "rep-r1a",
            receivableId: "r1a",
            valueDate: "2026-05-10",
            amountPaise: 30000,
            isDeleted: false,
            flowType: "reimbursement_in",
          },
        ],
      ],
    ]);
    const out = buildR15([b], recs, reps, "2026-05-30");
    expect(out.bills[0]!.outstandingPaise).toBe(0);
    expect(out.bills[0]!.settledPaise).toBe(60000);
  });

  it("excludes soft-deleted bills entirely", () => {
    const b = { ...bill("b1", 100, 0, [{ sharePaise: 100, settledPaise: 0, receivableId: "r1" }]), isDeleted: true };
    const out = buildR15([b], [rec("r1", 100)], new Map(), "2026-05-30");
    expect(out.totals.bills).toBe(0);
  });

  it("sorts bills newest-first by createdAt", () => {
    const a = bill("a", 100, 0, [{ sharePaise: 100, settledPaise: 0, receivableId: "ra" }], "open", "2026-04-01T00:00:00Z");
    const b = bill("b", 100, 0, [{ sharePaise: 100, settledPaise: 0, receivableId: "rb" }], "open", "2026-05-01T00:00:00Z");
    const recs = [rec("ra", 100), rec("rb", 100)];
    const out = buildR15([a, b], recs, new Map(), "2026-05-30");
    expect(out.bills.map((x) => x.splitBillId)).toEqual(["b", "a"]);
  });

  it("respects detectTurf predicate", () => {
    const b = bill("turf1", 900000, 150000, [
      { sharePaise: 150000, settledPaise: 0, receivableId: "r1" },
      { sharePaise: 150000, settledPaise: 0, receivableId: "r2" },
      { sharePaise: 150000, settledPaise: 0, receivableId: "r3" },
      { sharePaise: 150000, settledPaise: 0, receivableId: "r4" },
      { sharePaise: 150000, settledPaise: 0, receivableId: "r5" },
    ]);
    const recs = ["r1", "r2", "r3", "r4", "r5"].map((id) => rec(id, 150000));
    const out = buildR15([b], recs, new Map(), "2026-05-30", () => true);
    expect(out.bills[0]!.isTurf).toBe(true);
  });
});
