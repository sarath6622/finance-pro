import { describe, expect, it } from "vitest";
import {
  buildScheduledFlows,
  nextPaydayFrom,
  priorPaydayFrom,
  totalLiquidPaiseAt,
} from "./assemble";
import type { RuleLite } from "@/lib/recurring";
import { mkTxn } from "@/lib/test-utils/fixtures";

describe("nextPaydayFrom / priorPaydayFrom", () => {
  it("rolls to next month when asOf is past the payday this month", () => {
    expect(nextPaydayFrom("2026-06-10", 5)).toBe("2026-07-05");
    expect(nextPaydayFrom("2026-06-01", 5)).toBe("2026-06-05");
  });
  it("clamps day 31 to month-end (Feb-28/29 etc.)", () => {
    expect(nextPaydayFrom("2026-02-01", 31)).toBe("2026-02-28");
    expect(nextPaydayFrom("2024-02-01", 31)).toBe("2024-02-29");
  });
  it("priorPaydayFrom returns same month when asOf is on/after the payday", () => {
    expect(priorPaydayFrom("2026-06-10", 5)).toBe("2026-06-05");
    expect(priorPaydayFrom("2026-06-05", 5)).toBe("2026-06-05");
    expect(priorPaydayFrom("2026-06-03", 5)).toBe("2026-05-05");
  });
});

describe("totalLiquidPaiseAt", () => {
  it("sums asset bank/cash/wallet balances; clamps negatives to 0", () => {
    const accts = [
      {
        _id: "bank",
        name: "HDFC",
        kind: "bank" as const,
        classification: "asset" as const,
        openingBalancePaise: 5000000,
      },
      {
        _id: "cash",
        name: "Cash",
        kind: "cash" as const,
        classification: "asset" as const,
        openingBalancePaise: 100000,
      },
      {
        _id: "card",
        name: "HDFC Card",
        kind: "credit_card" as const,
        classification: "liability" as const,
        openingBalancePaise: 0,
      },
      {
        _id: "overdrawn",
        name: "Bad Bank",
        kind: "bank" as const,
        classification: "asset" as const,
        openingBalancePaise: 0,
      },
    ];
    const txns = [
      mkTxn({ accountId: "bank", flowType: "spend", direction: "out", amountPaise: 500000, valueDate: "2026-06-01" }),
      mkTxn({ accountId: "overdrawn", flowType: "spend", direction: "out", amountPaise: 10000, valueDate: "2026-06-01" }),
    ];
    const r = totalLiquidPaiseAt({ accounts: accts, transactions: txns, asOf: "2026-06-15" });
    expect(r.totalPaise).toBe(5000000 - 500000 + 100000);
    expect(r.perAccount).toHaveLength(3); // bank + cash + overdrawn (card excluded)
    expect(r.perAccount.find((a) => a._id === "overdrawn")!.paise).toBe(0);
  });
});

describe("buildScheduledFlows — drops paid occurrences", () => {
  const rule: RuleLite = {
    _id: "r1",
    label: "Rent",
    accountId: "bank",
    flowType: "family_support",
    amountPaise: 2500000,
    frequency: "monthly",
    dayOfMonth: 5,
    startDate: "2026-01-05",
    arrearsPolicy: "accumulate",
    status: "active",
  };

  it("emits one signed flow per expected occurrence in window", () => {
    const flows = buildScheduledFlows({
      asOf: "2026-06-01",
      horizonEnd: "2026-09-30",
      rules: [rule],
      ruleTxns: [],
      bookedFutureTxns: [],
    });
    expect(flows).toHaveLength(4);
    expect(flows.every((f) => f.signedPaise === -2500000)).toBe(true);
    expect(flows.map((f) => f.date)).toEqual([
      "2026-06-05",
      "2026-07-05",
      "2026-08-05",
      "2026-09-05",
    ]);
  });

  it("skips occurrences already paid (greedy match within tol)", () => {
    const paid = {
      ...mkTxn({
        accountId: "bank",
        flowType: "family_support",
        direction: "out",
        amountPaise: 2500000,
        valueDate: "2026-06-08", // within ±14d of expected 2026-06-05
      }),
      recurringRuleId: "r1",
    };
    const flows = buildScheduledFlows({
      asOf: "2026-06-01",
      horizonEnd: "2026-08-30",
      rules: [rule],
      ruleTxns: [paid],
      bookedFutureTxns: [],
    });
    // June dropped (paid), July + August remain
    expect(flows.map((f) => f.date)).toEqual(["2026-07-05", "2026-08-05"]);
  });

  it("paused rules are not expanded", () => {
    const flows = buildScheduledFlows({
      asOf: "2026-06-01",
      horizonEnd: "2026-09-30",
      rules: [{ ...rule, status: "paused" as const }],
      ruleTxns: [],
      bookedFutureTxns: [],
    });
    expect(flows).toEqual([]);
  });

  it("booked future txns become single-shot flows", () => {
    const future = mkTxn({
      accountId: "bank",
      flowType: "spend",
      direction: "out",
      amountPaise: 50000,
      valueDate: "2026-06-10",
    });
    const flows = buildScheduledFlows({
      asOf: "2026-06-01",
      horizonEnd: "2026-06-30",
      rules: [],
      ruleTxns: [],
      bookedFutureTxns: [future],
    });
    expect(flows).toHaveLength(1);
    expect(flows[0]!.signedPaise).toBe(-50000);
  });
});
