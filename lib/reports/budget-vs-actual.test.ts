import { describe, it, expect } from "vitest";
import {
  budgetVsActual,
  type BudgetLite,
  type CategoryLite,
} from "./budget-vs-actual";
import { buildPeriod } from "./period";
import type { TxnLite } from "@/lib/balances/types";
import { mkTxn } from "@/lib/test-utils/fixtures";

const MAY = buildPeriod({ mode: "calendar", anchorDay: 5, year: 2026, month: 5 });

const DINING: CategoryLite = { _id: "cat-dining", name: "Dining & Eating Out" };
const FUEL: CategoryLite = { _id: "cat-fuel", name: "Fuel" };
const TEA: CategoryLite = { _id: "cat-tea", name: "Daily Tea/Snacks" };

function mkBudget(categoryId: string, amountPaise: number, opts?: { rollover?: boolean }): BudgetLite {
  return {
    _id: `b-${categoryId}`,
    categoryId,
    month: "2026-05",
    amountPaise,
    rollover: opts?.rollover ?? false,
  };
}

describe("budgetVsActual — R3 budget vs actual per category", () => {
  it("computes variance per category and totals", () => {
    const txns: TxnLite[] = [
      { ...mkTxn({ accountId: "a", flowType: "spend", direction: "out", amountPaise: 80000, valueDate: "2026-05-10" }), categoryId: DINING._id },
      { ...mkTxn({ accountId: "a", flowType: "spend", direction: "out", amountPaise: 40000, valueDate: "2026-05-12" }), categoryId: DINING._id },
      { ...mkTxn({ accountId: "a", flowType: "spend", direction: "out", amountPaise: 200000, valueDate: "2026-05-13" }), categoryId: FUEL._id },
    ];
    const budgets = [mkBudget(DINING._id, 100000), mkBudget(FUEL._id, 250000)];
    const r = budgetVsActual({
      transactions: txns,
      budgets,
      categories: [DINING, FUEL, TEA],
      period: MAY,
    });
    expect(r.byCategory).toHaveLength(2);
    const dining = r.byCategory.find((c) => c.categoryId === DINING._id)!;
    expect(dining.budgetPaise).toBe(100000);
    expect(dining.actualPaise).toBe(120000);
    expect(dining.variancePaise).toBe(-20000);
    expect(dining.status).toBe("over");
    const fuel = r.byCategory.find((c) => c.categoryId === FUEL._id)!;
    expect(fuel.variancePaise).toBe(50000);
    expect(fuel.status).toBe("under");
    expect(r.totals.budgetedPaise).toBe(350000);
    expect(r.totals.actualPaise).toBe(320000);
    expect(r.totals.variancePaise).toBe(30000);
  });

  it("reports unbudgeted categories that had activity", () => {
    const txns: TxnLite[] = [
      { ...mkTxn({ accountId: "a", flowType: "spend", direction: "out", amountPaise: 50000, valueDate: "2026-05-10" }), categoryId: TEA._id },
      { ...mkTxn({ accountId: "a", flowType: "spend", direction: "out", amountPaise: 80000, valueDate: "2026-05-11" }), categoryId: DINING._id },
    ];
    const budgets = [mkBudget(DINING._id, 100000)];
    const r = budgetVsActual({
      transactions: txns,
      budgets,
      categories: [DINING, TEA],
      period: MAY,
    });
    expect(r.unbudgeted).toEqual([
      { categoryId: TEA._id, categoryName: TEA.name, actualPaise: 50000 },
    ]);
  });

  it("filters budgets to the period's month only", () => {
    const txns: TxnLite[] = [
      { ...mkTxn({ accountId: "a", flowType: "spend", direction: "out", amountPaise: 50000, valueDate: "2026-05-10" }), categoryId: DINING._id },
    ];
    const budgets = [
      mkBudget(DINING._id, 100000),
      { ...mkBudget(DINING._id, 999999), month: "2026-04" },
    ];
    const r = budgetVsActual({
      transactions: txns,
      budgets,
      categories: [DINING],
      period: MAY,
    });
    expect(r.byCategory).toHaveLength(1);
    expect(r.byCategory[0]!.budgetPaise).toBe(100000);
  });

  it("excludes split parent containers from actual (E1)", () => {
    const parent: TxnLite & { categoryId: string } = {
      ...mkTxn({
        accountId: "a",
        _id: "p",
        amountPaise: 200000,
        flowType: "spend",
        direction: "out",
        valueDate: "2026-05-10",
      }),
      categoryId: DINING._id,
    };
    const child: TxnLite & { categoryId: string } = {
      ...mkTxn({
        accountId: "a",
        parentTransactionId: "p",
        amountPaise: 200000,
        flowType: "spend",
        direction: "out",
        valueDate: "2026-05-10",
      }),
      categoryId: DINING._id,
    };
    const budgets = [mkBudget(DINING._id, 300000)];
    const r = budgetVsActual({
      transactions: [parent, child],
      budgets,
      categories: [DINING],
      period: MAY,
    });
    expect(r.byCategory[0]!.actualPaise).toBe(200000);
  });

  it("includes fee txns in spend totals (FR-1 fee subtype of spend)", () => {
    const FEES: CategoryLite = { _id: "cat-fee", name: "Fees & Charges" };
    const txns: TxnLite[] = [
      { ...mkTxn({ accountId: "a", flowType: "fee", direction: "out", amountPaise: 1500, valueDate: "2026-05-10" }), categoryId: FEES._id },
    ];
    const budgets = [mkBudget(FEES._id, 5000)];
    const r = budgetVsActual({
      transactions: txns,
      budgets,
      categories: [FEES],
      period: MAY,
    });
    expect(r.byCategory[0]!.actualPaise).toBe(1500);
  });

  it("preserves rollover flag in output (computation deferred to caller)", () => {
    const txns: TxnLite[] = [];
    const budgets = [mkBudget(DINING._id, 100000, { rollover: true })];
    const r = budgetVsActual({
      transactions: txns,
      budgets,
      categories: [DINING],
      period: MAY,
    });
    expect(r.byCategory[0]!.rollover).toBe(true);
  });
});
