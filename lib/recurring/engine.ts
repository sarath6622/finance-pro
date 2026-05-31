import type { FlowType } from "@/lib/schemas/common";
import type { TxnLite } from "@/lib/balances/types";

export type Frequency = "monthly" | "weekly" | "custom";
export type ArrearsPolicy = "accumulate" | "skip";
export type RuleStatus = "active" | "paused" | "ended";
export type ObligationStatus = "upcoming" | "due_today" | "overdue" | "paid" | "skipped";

export interface RuleLite {
  _id: string;
  label: string;
  accountId: string;
  counterpartyId?: string;
  categoryId?: string;
  flowType: FlowType;
  amountPaise: number;
  frequency: Frequency;
  dayOfMonth?: number;
  startDate: string;
  endDate?: string;
  arrearsPolicy: ArrearsPolicy;
  status: RuleStatus;
}

export interface Obligation {
  ruleId: string;
  ruleLabel: string;
  expectedDate: string;
  amountPaise: number;
  flowType: FlowType;
  accountId: string;
  counterpartyId?: string;
  categoryId?: string;
  status: ObligationStatus;
  paidByTxnId?: string;
  cycleIndex?: number;
  totalCycles?: number;
  arrearsPolicy: ArrearsPolicy;
}

const TOLERANCE_DAYS: Record<Frequency, number> = {
  monthly: 14,
  weekly: 3,
  custom: 0,
};

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}
function daysInMonth(year: number, month1to12: number): number {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}
function ymd(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}
function parseYmd(date: string): { year: number; month: number; day: number } {
  const [y, m, d] = date.slice(0, 10).split("-").map((s) => parseInt(s, 10));
  return { year: y!, month: m!, day: d! };
}
function dateDelta(a: string, b: string): number {
  const da = new Date(`${a.slice(0, 10)}T00:00:00.000Z`).getTime();
  const db = new Date(`${b.slice(0, 10)}T00:00:00.000Z`).getTime();
  return Math.round((da - db) / 86400000);
}
function addDaysIso(iso: string, deltaDays: number): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

export function expectedOccurrences(rule: RuleLite, fromIso: string, toIso: string): string[] {
  if (rule.status !== "active") return [];
  const from = fromIso.slice(0, 10);
  const to = toIso.slice(0, 10);
  const endCap = rule.endDate ? rule.endDate.slice(0, 10) : "9999-12-31";
  const ceil = to < endCap ? to : endCap;

  const out: string[] = [];

  if (rule.frequency === "monthly") {
    const startParts = parseYmd(rule.startDate);
    const requestedDom = rule.dayOfMonth ?? startParts.day;
    let year = startParts.year;
    let month = startParts.month;
    while (true) {
      const dom = Math.min(requestedDom, daysInMonth(year, month));
      const candidate = ymd(year, month, dom);
      if (candidate > ceil) break;
      if (candidate >= rule.startDate.slice(0, 10) && candidate >= from) {
        out.push(candidate);
      }
      month++;
      if (month > 12) {
        month = 1;
        year++;
      }
    }
  } else if (rule.frequency === "weekly") {
    let cursor = rule.startDate.slice(0, 10);
    while (cursor <= ceil) {
      if (cursor >= from) out.push(cursor);
      cursor = addDaysIso(cursor, 7);
    }
  }
  // "custom" frequency is reserved for future schedules; no occurrences yet.

  return out;
}

export function totalCycles(rule: RuleLite): number | undefined {
  if (!rule.endDate) return undefined;
  return expectedOccurrences(rule, rule.startDate, rule.endDate).length;
}

interface MatchResult {
  txn: TxnLite;
  occurrenceIndex: number;
}

function findMatch(
  occurrence: string,
  candidates: TxnLite[],
  toleranceDays: number,
  consumed: Set<string>,
): TxnLite | undefined {
  let best: TxnLite | undefined;
  let bestDist = Infinity;
  for (const t of candidates) {
    if (consumed.has(t._id)) continue;
    if (t.isDeleted) continue;
    const dist = Math.abs(dateDelta(t.valueDate, occurrence));
    if (dist <= toleranceDays && dist < bestDist) {
      best = t;
      bestDist = dist;
    }
  }
  return best;
}

export interface ObligationsBuckets {
  upcoming: Obligation[];
  arrears: Obligation[];
  paid: Obligation[];
}

export function computeObligations(
  rules: RuleLite[],
  transactions: TxnLite[],
  asOfIso: string,
  horizonDays = 30,
): ObligationsBuckets {
  const asOf = asOfIso.slice(0, 10);
  const horizonEnd = addDaysIso(asOf, horizonDays);
  const out: ObligationsBuckets = { upcoming: [], arrears: [], paid: [] };

  for (const rule of rules) {
    const occurrences = expectedOccurrences(
      rule,
      rule.startDate,
      horizonEnd,
    );
    const cyclesTotal = totalCycles(rule);
    const ruleTxns = transactions.filter((t) => t.recurringRuleId === rule._id);
    const consumed = new Set<string>();
    const tol = TOLERANCE_DAYS[rule.frequency];

    occurrences.forEach((expected, idx) => {
      const match = findMatch(expected, ruleTxns, tol, consumed);
      if (match) consumed.add(match._id);
      const base: Obligation = {
        ruleId: rule._id,
        ruleLabel: rule.label,
        expectedDate: expected,
        amountPaise: rule.amountPaise,
        flowType: rule.flowType,
        accountId: rule.accountId,
        ...(rule.counterpartyId ? { counterpartyId: rule.counterpartyId } : {}),
        ...(rule.categoryId ? { categoryId: rule.categoryId } : {}),
        arrearsPolicy: rule.arrearsPolicy,
        status: "upcoming",
        cycleIndex: idx + 1,
        ...(cyclesTotal !== undefined ? { totalCycles: cyclesTotal } : {}),
      };
      if (match) {
        out.paid.push({ ...base, status: "paid", paidByTxnId: match._id });
      } else if (expected < asOf) {
        if (rule.arrearsPolicy === "accumulate") {
          out.arrears.push({ ...base, status: "overdue" });
        } else {
          out.paid.push({ ...base, status: "skipped" });
        }
      } else if (expected === asOf) {
        out.upcoming.push({ ...base, status: "due_today" });
      } else {
        out.upcoming.push({ ...base, status: "upcoming" });
      }
    });
  }

  out.upcoming.sort((a, b) => a.expectedDate.localeCompare(b.expectedDate));
  out.arrears.sort((a, b) => a.expectedDate.localeCompare(b.expectedDate));
  return out;
}
