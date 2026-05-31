import { describe, expect, it } from "vitest";
import { buildEmiCalendar } from "./emi-calendar";
import type { Obligation } from "@/lib/recurring/engine";

function o(
  ruleId: string,
  date: string,
  amount: number,
  status: Obligation["status"],
  flowType: Obligation["flowType"] = "debt_repayment",
): Obligation {
  return {
    ruleId,
    ruleLabel: ruleId,
    expectedDate: date,
    amountPaise: amount,
    flowType,
    accountId: "bank",
    status,
    arrearsPolicy: "accumulate",
  };
}

describe("buildEmiCalendar (R13)", () => {
  it("buckets by month and sorts ascending", () => {
    const obs: Obligation[] = [
      o("L1", "2026-05-05", 25000, "overdue"),
      o("L2", "2026-06-05", 25000, "upcoming"),
      o("L1", "2026-06-05", 25000, "upcoming"),
      o("L1", "2026-04-05", 25000, "paid"),
    ];
    const r = buildEmiCalendar(obs, new Map([["L1", "acc-A"], ["L2", "acc-B"]]), "2026-05-30");
    expect(r.totalMonths).toBe(3);
    expect(r.months.map((m) => m.yyyyMm)).toEqual(["2026-04", "2026-05", "2026-06"]);
    expect(r.months[2]!.rows).toHaveLength(2);
    expect(r.months[2]!.totalPaise).toBe(50000);
    expect(r.totalEmiPaise).toBe(100000);
    expect(r.overdueCount).toBe(1);
    expect(r.upcomingCount).toBe(2);
  });

  it("skips non debt_repayment flows", () => {
    const obs: Obligation[] = [
      o("L1", "2026-05-05", 25000, "upcoming"),
      o("R1", "2026-05-05", 5000, "upcoming", "spend"),
    ];
    const r = buildEmiCalendar(obs, new Map(), "2026-05-30");
    expect(r.totalEmiPaise).toBe(25000);
    expect(r.months[0]!.rows.every((row) => row.ruleId !== "R1")).toBe(true);
  });

  it("propagates debtAccountId from the rule mapping", () => {
    const obs: Obligation[] = [o("L1", "2026-05-05", 25000, "upcoming")];
    const r = buildEmiCalendar(obs, new Map([["L1", "loanX"]]), "2026-05-30");
    expect(r.months[0]!.rows[0]!.debtAccountId).toBe("loanX");
  });
});
