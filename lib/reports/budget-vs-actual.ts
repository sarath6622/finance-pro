import {
  isSplitParentContainer,
  liveChildrenByParent,
} from "@/lib/balances/filters";
import type { TxnLite } from "@/lib/balances/types";
import { isInPeriod, periodKey, type Period } from "./period";

export interface BudgetLite {
  _id: string;
  categoryId: string;
  month: string;
  amountPaise: number;
  rollover: boolean;
}

export interface CategoryLite {
  _id: string;
  name: string;
}

export type BudgetStatus = "under" | "at" | "over" | "no-budget";

export interface BudgetCategoryRow {
  categoryId: string;
  categoryName: string;
  budgetPaise: number;
  actualPaise: number;
  variancePaise: number;
  utilizationPct: number;
  rollover: boolean;
  status: BudgetStatus;
}

export interface BudgetUnbudgetedRow {
  categoryId: string;
  categoryName: string;
  actualPaise: number;
}

export interface BudgetVsActual {
  period: Period;
  totals: {
    budgetedPaise: number;
    actualPaise: number;
    variancePaise: number;
  };
  byCategory: BudgetCategoryRow[];
  unbudgeted: BudgetUnbudgetedRow[];
}

export interface BudgetVsActualInput {
  transactions: TxnLite[];
  budgets: BudgetLite[];
  categories: CategoryLite[];
  period: Period;
}

function statusFor(variance: number): BudgetStatus {
  if (variance > 0) return "under";
  if (variance < 0) return "over";
  return "at";
}

export function budgetVsActual(input: BudgetVsActualInput): BudgetVsActual {
  const { transactions, budgets, categories, period } = input;
  const monthStr = periodKey(period);
  const childrenByParent = liveChildrenByParent(transactions);

  const actualByCat = new Map<string, number>();
  for (const t of transactions) {
    if (t.isDeleted) continue;
    if (isSplitParentContainer(t, childrenByParent)) continue;
    if (!isInPeriod(t.valueDate, period)) continue;
    if (t.flowType !== "spend" && t.flowType !== "fee") continue;
    if (!("categoryId" in t)) continue;
    const cid = (t as TxnLite & { categoryId?: string }).categoryId;
    if (!cid) continue;
    // SplitBill source spend counts only the owner's share toward budgets;
    // the rest is owed by others.
    const effective =
      t.flowType === "spend" && typeof t.splitOwnSharePaise === "number"
        ? Math.max(0, Math.min(t.splitOwnSharePaise, t.amountPaise))
        : t.amountPaise;
    actualByCat.set(cid, (actualByCat.get(cid) ?? 0) + effective);
  }

  const catById = new Map(categories.map((c) => [c._id, c]));
  const budgetsThisMonth = budgets.filter((b) => b.month === monthStr);
  const budgetByCat = new Map(budgetsThisMonth.map((b) => [b.categoryId, b]));

  const byCategory: BudgetCategoryRow[] = [];
  let budgetedTotal = 0;
  let actualTotal = 0;
  for (const b of budgetsThisMonth) {
    const cat = catById.get(b.categoryId);
    if (!cat) continue;
    const actual = actualByCat.get(b.categoryId) ?? 0;
    const variance = b.amountPaise - actual;
    // eslint-disable-next-line no-restricted-syntax -- utilization %, not money math
    const utilization = b.amountPaise > 0 ? (actual / b.amountPaise) * 100 : 0;
    byCategory.push({
      categoryId: b.categoryId,
      categoryName: cat.name,
      budgetPaise: b.amountPaise,
      actualPaise: actual,
      variancePaise: variance,
      utilizationPct: Math.round(utilization * 10) / 10,
      rollover: b.rollover,
      status: statusFor(variance),
    });
    budgetedTotal += b.amountPaise;
    actualTotal += actual;
  }
  byCategory.sort((a, b) => a.categoryName.localeCompare(b.categoryName));

  const unbudgeted: BudgetUnbudgetedRow[] = [];
  for (const [cid, actual] of actualByCat) {
    if (budgetByCat.has(cid)) continue;
    const cat = catById.get(cid);
    if (!cat) continue;
    unbudgeted.push({ categoryId: cid, categoryName: cat.name, actualPaise: actual });
  }
  unbudgeted.sort((a, b) => b.actualPaise - a.actualPaise);

  return {
    period,
    totals: {
      budgetedPaise: budgetedTotal,
      actualPaise: actualTotal,
      variancePaise: budgetedTotal - actualTotal,
    },
    byCategory,
    unbudgeted,
  };
}
