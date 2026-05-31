import { describe, it, expect } from "vitest";
import {
  computeObligations,
  expectedOccurrences,
  totalCycles,
  type RuleLite,
} from "./engine";
import type { TxnLite } from "@/lib/balances/types";
import { mkTxn } from "@/lib/test-utils/fixtures";

function mkRule(overrides: Partial<RuleLite> = {}): RuleLite {
  return {
    _id: "rule-1",
    label: "Dad",
    accountId: "hdfc-bank",
    counterpartyId: "cp-dad",
    flowType: "family_support",
    amountPaise: 2500000,
    frequency: "monthly",
    dayOfMonth: 5,
    startDate: "2026-01-05",
    arrearsPolicy: "accumulate",
    status: "active",
    ...overrides,
  };
}

describe("expectedOccurrences — monthly", () => {
  it("generates one per month from startDate up to ceil", () => {
    const rule = mkRule({ startDate: "2026-01-05" });
    const occ = expectedOccurrences(rule, "2026-01-01", "2026-06-30");
    expect(occ).toEqual([
      "2026-01-05",
      "2026-02-05",
      "2026-03-05",
      "2026-04-05",
      "2026-05-05",
      "2026-06-05",
    ]);
  });

  it("clamps dayOfMonth 31 to last day of short months", () => {
    const rule = mkRule({ startDate: "2026-01-31", dayOfMonth: 31 });
    const occ = expectedOccurrences(rule, "2026-01-01", "2026-04-30");
    expect(occ).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
    ]);
  });

  it("respects endDate (E3)", () => {
    const rule = mkRule({
      startDate: "2026-03-01",
      dayOfMonth: 1,
      endDate: "2026-05-01",
    });
    const occ = expectedOccurrences(rule, "2026-01-01", "2026-12-31");
    expect(occ).toEqual(["2026-03-01", "2026-04-01", "2026-05-01"]);
  });

  it("returns [] for paused or ended rules", () => {
    expect(
      expectedOccurrences(mkRule({ status: "paused" }), "2026-01-01", "2026-12-31"),
    ).toEqual([]);
    expect(
      expectedOccurrences(mkRule({ status: "ended" }), "2026-01-01", "2026-12-31"),
    ).toEqual([]);
  });

  it("excludes occurrences before fromDate", () => {
    const rule = mkRule({ startDate: "2026-01-05" });
    const occ = expectedOccurrences(rule, "2026-04-01", "2026-06-30");
    expect(occ).toEqual(["2026-04-05", "2026-05-05", "2026-06-05"]);
  });
});

describe("expectedOccurrences — weekly", () => {
  it("steps by 7 days from startDate", () => {
    const rule = mkRule({
      frequency: "weekly",
      startDate: "2026-05-01",
      dayOfMonth: undefined,
    });
    const occ = expectedOccurrences(rule, "2026-05-01", "2026-05-31");
    expect(occ).toEqual([
      "2026-05-01",
      "2026-05-08",
      "2026-05-15",
      "2026-05-22",
      "2026-05-29",
    ]);
  });
});

describe("totalCycles — for fixed-end rules (E3 AC EMI)", () => {
  it("returns the number of monthly cycles between startDate and endDate", () => {
    const ac = mkRule({
      startDate: "2026-04-10",
      dayOfMonth: 10,
      endDate: "2026-06-10",
    });
    expect(totalCycles(ac)).toBe(3); // 4/10, 5/10, 6/10
  });

  it("returns undefined when there is no endDate", () => {
    expect(totalCycles(mkRule())).toBeUndefined();
  });
});

describe("computeObligations — bucketing (FR-10, FR-11)", () => {
  const dadRule = mkRule({
    _id: "rule-dad",
    startDate: "2026-03-05",
  });
  const asOf = "2026-05-30";

  it("classifies past+unpaid as overdue arrears when policy=accumulate (E2)", () => {
    const r = computeObligations([dadRule], [], asOf, 30);
    const overdueDates = r.arrears.map((o) => o.expectedDate);
    expect(overdueDates).toEqual(["2026-03-05", "2026-04-05", "2026-05-05"]);
    expect(r.arrears.every((o) => o.status === "overdue")).toBe(true);
  });

  it("classifies past+unpaid as 'skipped' when policy=skip — not in arrears", () => {
    const r = computeObligations(
      [{ ...dadRule, arrearsPolicy: "skip" }],
      [],
      asOf,
      30,
    );
    expect(r.arrears).toEqual([]);
    expect(r.paid.filter((o) => o.status === "skipped")).toHaveLength(3);
  });

  it("matches a txn within the monthly tolerance window (±14 days)", () => {
    const matched = mkTxn({
      accountId: "hdfc-bank",
      valueDate: "2026-04-08",
      flowType: "family_support",
      direction: "out",
      amountPaise: 2500000,
    });
    matched.recurringRuleId = dadRule._id;
    const r = computeObligations([dadRule], [matched], asOf, 30);
    const aprilPaid = r.paid.find((o) => o.expectedDate === "2026-04-05");
    expect(aprilPaid).toBeDefined();
    expect(aprilPaid?.paidByTxnId).toBe(matched._id);
    expect(r.arrears.find((o) => o.expectedDate === "2026-04-05")).toBeUndefined();
  });

  it("rejects a txn beyond the tolerance window", () => {
    const tooFar = mkTxn({
      accountId: "hdfc-bank",
      valueDate: "2026-04-25",
      flowType: "family_support",
      direction: "out",
      amountPaise: 2500000,
    });
    tooFar.recurringRuleId = dadRule._id;
    const r = computeObligations([dadRule], [tooFar], asOf, 30);
    expect(r.arrears.find((o) => o.expectedDate === "2026-04-05")).toBeDefined();
  });

  it("each txn matches at most one occurrence (closest unconsumed)", () => {
    const a = mkTxn({
      accountId: "hdfc-bank",
      valueDate: "2026-04-05",
      direction: "out",
      flowType: "family_support",
      amountPaise: 2500000,
    });
    a.recurringRuleId = dadRule._id;
    const b = mkTxn({
      accountId: "hdfc-bank",
      valueDate: "2026-05-05",
      direction: "out",
      flowType: "family_support",
      amountPaise: 2500000,
    });
    b.recurringRuleId = dadRule._id;
    const r = computeObligations([dadRule], [a, b], asOf, 30);
    const paidIds = new Set(r.paid.map((o) => o.paidByTxnId));
    expect(paidIds.has(a._id)).toBe(true);
    expect(paidIds.has(b._id)).toBe(true);
    // March still overdue
    expect(r.arrears.find((o) => o.expectedDate === "2026-03-05")).toBeDefined();
  });

  it("marks today's occurrence as due_today", () => {
    const rule = mkRule({ _id: "rule-today", startDate: "2026-05-30", dayOfMonth: 30 });
    const r = computeObligations([rule], [], "2026-05-30", 30);
    expect(r.upcoming).toHaveLength(1);
    expect(r.upcoming[0]!.status).toBe("due_today");
  });

  it("includes upcoming within horizonDays", () => {
    const rule = mkRule({ _id: "rule-fut", startDate: "2026-06-05" });
    const r = computeObligations([rule], [], "2026-05-30", 30);
    expect(r.upcoming).toHaveLength(1);
    expect(r.upcoming[0]!.expectedDate).toBe("2026-06-05");
    expect(r.upcoming[0]!.status).toBe("upcoming");
  });

  it("excludes occurrences beyond horizonDays", () => {
    const rule = mkRule({ _id: "rule-far", startDate: "2026-07-05" });
    const r = computeObligations([rule], [], "2026-05-30", 30);
    expect(r.upcoming).toHaveLength(0);
  });

  it("annotates cycleIndex / totalCycles for fixed-end rules (E3 'X of N')", () => {
    const ac = mkRule({
      _id: "rule-ac",
      label: "AC EMI",
      flowType: "debt_repayment",
      startDate: "2026-04-10",
      dayOfMonth: 10,
      endDate: "2026-06-10",
      amountPaise: 1000000,
    });
    const r = computeObligations([ac], [], "2026-05-30", 60);
    const all = [...r.paid, ...r.arrears, ...r.upcoming];
    const may = all.find((o) => o.expectedDate === "2026-05-10");
    expect(may?.cycleIndex).toBe(2);
    expect(may?.totalCycles).toBe(3);
    const june = all.find((o) => o.expectedDate === "2026-06-10");
    expect(june?.cycleIndex).toBe(3);
    expect(june?.totalCycles).toBe(3);
    // No July
    expect(all.find((o) => o.expectedDate === "2026-07-10")).toBeUndefined();
  });
});
