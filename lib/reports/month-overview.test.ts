import { describe, it, expect } from "vitest";
import { monthOverview } from "./month-overview";
import { buildPeriod } from "./period";
import type { TxnLite } from "@/lib/balances/types";
import { mkTxn } from "@/lib/test-utils/fixtures";

const MAY_CAL = buildPeriod({ mode: "calendar", anchorDay: 5, year: 2026, month: 5 });
const MAY_CYCLE = buildPeriod({ mode: "pay_cycle", anchorDay: 5, year: 2026, month: 5 });

describe("monthOverview — big buckets (R2)", () => {
  it("separates spend / income / family / debt / invest / lending / card_settlement", () => {
    const txns: TxnLite[] = [
      mkTxn({ accountId: "a", flowType: "income", direction: "in", amountPaise: 10000000, valueDate: "2026-05-05" }),
      mkTxn({ accountId: "a", flowType: "spend", direction: "out", amountPaise: 50000, valueDate: "2026-05-10" }),
      mkTxn({ accountId: "a", flowType: "family_support", direction: "out", amountPaise: 2500000, valueDate: "2026-05-05" }),
      mkTxn({ accountId: "a", flowType: "debt_repayment", direction: "out", amountPaise: 300000, valueDate: "2026-05-07" }),
      mkTxn({ accountId: "a", flowType: "investment", direction: "out", amountPaise: 1000000, valueDate: "2026-05-15" }),
      mkTxn({ accountId: "a", flowType: "lending_out", direction: "out", amountPaise: 200000, valueDate: "2026-05-20" }),
      mkTxn({ accountId: "a", flowType: "card_settlement", direction: "out", amountPaise: 800000, valueDate: "2026-05-25" }),
    ];
    const r = monthOverview({ transactions: txns, period: MAY_CAL });
    expect(r.income).toBe(10000000);
    expect(r.spend.total).toBe(50000);
    expect(r.familySupport).toBe(2500000);
    expect(r.debtRepayment).toBe(300000);
    expect(r.investment).toBe(1000000);
    expect(r.lendingOut).toBe(200000);
    expect(r.cardSettlement).toBe(800000);
    expect(r.txnCount).toBe(7);
  });

  it("breaks spend into need / want / unclassified / fee", () => {
    const txns: TxnLite[] = [
      mkTxn({ accountId: "a", flowType: "spend", direction: "out", amountPaise: 30000, valueDate: "2026-05-10" }) as TxnLite,
      { ...mkTxn({ accountId: "a", flowType: "spend", direction: "out", amountPaise: 70000, valueDate: "2026-05-11" }), needWant: "need" } as TxnLite & { needWant: "need" | "want" },
      { ...mkTxn({ accountId: "a", flowType: "spend", direction: "out", amountPaise: 40000, valueDate: "2026-05-12" }), needWant: "want" } as TxnLite & { needWant: "need" | "want" },
      mkTxn({ accountId: "a", flowType: "fee", direction: "out", amountPaise: 1500, valueDate: "2026-05-13" }),
    ];
    const r = monthOverview({ transactions: txns, period: MAY_CAL });
    expect(r.spend.need).toBe(70000);
    expect(r.spend.want).toBe(40000);
    expect(r.spend.unclassified).toBe(30000);
    expect(r.spend.fee).toBe(1500);
    expect(r.spend.total).toBe(140000);
  });

  it("excludes split-parent containers; counts children (E1)", () => {
    const parent: TxnLite = mkTxn({
      accountId: "a",
      _id: "p",
      amountPaise: 6000000,
      flowType: "spend",
      direction: "out",
      valueDate: "2026-05-10",
    });
    const c1 = mkTxn({
      accountId: "a",
      parentTransactionId: "p",
      amountPaise: 2500000,
      flowType: "family_support",
      direction: "out",
      valueDate: "2026-05-10",
    });
    const c2 = mkTxn({
      accountId: "a",
      parentTransactionId: "p",
      amountPaise: 3500000,
      flowType: "debt_repayment",
      direction: "out",
      valueDate: "2026-05-10",
    });
    const r = monthOverview({ transactions: [parent, c1, c2], period: MAY_CAL });
    expect(r.spend.total).toBe(0);
    expect(r.familySupport).toBe(2500000);
    expect(r.debtRepayment).toBe(3500000);
  });

  it("excludes soft-deleted", () => {
    const txns: TxnLite[] = [
      mkTxn({ accountId: "a", flowType: "spend", direction: "out", amountPaise: 50000, valueDate: "2026-05-10" }),
      mkTxn({
        accountId: "a",
        flowType: "spend",
        direction: "out",
        amountPaise: 99999999,
        valueDate: "2026-05-11",
        isDeleted: true,
      }),
    ];
    const r = monthOverview({ transactions: txns, period: MAY_CAL });
    expect(r.spend.total).toBe(50000);
  });

  it("splits SplitBill source spend: only ownShare counts as spend, rest goes to lending_out", () => {
    const split: TxnLite = {
      ...mkTxn({
        accountId: "a",
        flowType: "spend",
        direction: "out",
        amountPaise: 120000,
        valueDate: "2026-05-15",
      }),
      needWant: "want",
      splitId: "sb1",
      splitOwnSharePaise: 30000,
    };
    const r = monthOverview({ transactions: [split], period: MAY_CAL });
    expect(r.spend.total).toBe(30000);
    expect(r.spend.want).toBe(30000);
    expect(r.lendingOut).toBe(90000);
    expect(r.byFlowType.spend).toBe(30000);
    expect(r.byFlowType.lending_out).toBe(90000);
  });

  it("filters by period — calendar vs pay-cycle (E11)", () => {
    const txns: TxnLite[] = [
      mkTxn({ accountId: "a", flowType: "spend", direction: "out", amountPaise: 10000, valueDate: "2026-05-03" }),
      mkTxn({ accountId: "a", flowType: "spend", direction: "out", amountPaise: 20000, valueDate: "2026-05-10" }),
      mkTxn({ accountId: "a", flowType: "spend", direction: "out", amountPaise: 30000, valueDate: "2026-06-02" }),
    ];
    expect(monthOverview({ transactions: txns, period: MAY_CAL }).spend.total).toBe(30000);
    expect(monthOverview({ transactions: txns, period: MAY_CYCLE }).spend.total).toBe(50000);
  });
});
