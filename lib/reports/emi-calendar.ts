import type { Obligation } from "@/lib/recurring/engine";

export interface EmiCalendarRow {
  ruleId: string;
  ruleLabel: string;
  expectedDate: string;
  amountPaise: number;
  status: Obligation["status"];
  accountId: string;
  debtAccountId?: string;
  paidByTxnId?: string;
  cycleIndex?: number;
  totalCycles?: number;
}

export interface EmiCalendarMonth {
  yyyyMm: string;
  rows: EmiCalendarRow[];
  totalPaise: number;
}

export interface EmiCalendarReport {
  asOf: string;
  totalMonths: number;
  totalEmiPaise: number;
  upcomingCount: number;
  overdueCount: number;
  months: EmiCalendarMonth[];
}

/**
 * Build R13 from the obligation set (already filtered to debt_repayment) plus
 * any link table from ruleId → debtAccountId so each row knows which loan it
 * targets. Pure — caller hands in the obligations.
 */
export function buildEmiCalendar(
  obligations: Obligation[],
  ruleToDebtAccount: Map<string, string | undefined>,
  asOf: string,
): EmiCalendarReport {
  const buckets = new Map<string, EmiCalendarRow[]>();
  let upcoming = 0;
  let overdue = 0;
  let total = 0;
  for (const o of obligations) {
    if (o.flowType !== "debt_repayment") continue;
    const yyyyMm = o.expectedDate.slice(0, 7);
    const list = buckets.get(yyyyMm) ?? [];
    list.push({
      ruleId: o.ruleId,
      ruleLabel: o.ruleLabel,
      expectedDate: o.expectedDate,
      amountPaise: o.amountPaise,
      status: o.status,
      accountId: o.accountId,
      ...(ruleToDebtAccount.get(o.ruleId)
        ? { debtAccountId: ruleToDebtAccount.get(o.ruleId) }
        : {}),
      ...(o.paidByTxnId ? { paidByTxnId: o.paidByTxnId } : {}),
      ...(o.cycleIndex !== undefined ? { cycleIndex: o.cycleIndex } : {}),
      ...(o.totalCycles !== undefined ? { totalCycles: o.totalCycles } : {}),
    });
    buckets.set(yyyyMm, list);
    total += o.amountPaise;
    if (o.status === "overdue") overdue += 1;
    else if (o.status === "upcoming" || o.status === "due_today") upcoming += 1;
  }

  const months: EmiCalendarMonth[] = [];
  for (const [yyyyMm, rows] of [...buckets.entries()].sort()) {
    rows.sort((a, b) => a.expectedDate.localeCompare(b.expectedDate));
    months.push({
      yyyyMm,
      rows,
      totalPaise: rows.reduce((s, r) => s + r.amountPaise, 0),
    });
  }

  return {
    asOf,
    totalMonths: months.length,
    totalEmiPaise: total,
    upcomingCount: upcoming,
    overdueCount: overdue,
    months,
  };
}
