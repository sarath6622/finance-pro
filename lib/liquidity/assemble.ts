import type { TxnLite } from "@/lib/balances/types";
import { accountBalanceAt } from "@/lib/balances/compute";
import type { RuleLite } from "@/lib/recurring";
import { expectedOccurrences } from "@/lib/recurring/engine";
import type { ScheduledFlow } from "@/lib/projection/liquidity";

export interface AssembleAccountsInput {
  /** Active accounts with classification + opening + kind */
  accounts: Array<{
    _id: string;
    name: string;
    kind: "bank" | "credit_card" | "cash" | "investment" | "loan" | "wallet";
    classification: "asset" | "liability";
    openingBalancePaise: number;
    openingDate?: string;
  }>;
  transactions: TxnLite[];
  asOf: string;
}

const LIQUID_KINDS = new Set(["bank", "cash", "wallet"]);

/**
 * Total current liquid cash (bank + cash + wallet) derived from each account's
 * ledger up to and including asOf. Negative balances are clamped to 0 — an
 * overdrawn bank is "0 liquid + already breaching" rather than negative cash.
 */
export function totalLiquidPaiseAt(input: AssembleAccountsInput): {
  totalPaise: number;
  perAccount: Array<{ _id: string; name: string; paise: number }>;
} {
  const perAccount: Array<{ _id: string; name: string; paise: number }> = [];
  let total = 0;
  for (const a of input.accounts) {
    if (!LIQUID_KINDS.has(a.kind)) continue;
    const bal = accountBalanceAt(a._id, {
      transactions: input.transactions,
      accounts: [a],
      cutoff: input.asOf,
    }).ownerPerspectivePaise;
    const positive = Math.max(0, bal);
    perAccount.push({ _id: a._id, name: a.name, paise: positive });
    total += positive;
  }
  return { totalPaise: total, perAccount };
}

/* ----------------------------------------------------------------------- */
/* Build the ScheduledFlow stream for the forecast window                   */
/* ----------------------------------------------------------------------- */

const OUT_FLOWS = new Set([
  "spend",
  "family_support",
  "investment",
  "debt_repayment",
  "lending_out",
  "fee",
]);
const IN_FLOWS = new Set(["income", "lending_repaid", "reimbursement_in"]);

export interface FlowsBuildInput {
  asOf: string;
  horizonEnd: string;
  rules: RuleLite[];
  /**
   * Transactions whose recurringRuleId matches one of the rules — used so
   * already-paid future cycles get DEDUCTED from the rule's expected outflow
   * (the txn ledger has already debited the bank).
   */
  ruleTxns: TxnLite[];
  /**
   * Booked future transactions (valueDate > asOf) that aren't covered by a
   * recurring rule — e.g. a one-off receivable repayment scheduled tomorrow.
   * We assume they will clear on their valueDate.
   */
  bookedFutureTxns: TxnLite[];
}

function signOf(flowType: string, direction: "in" | "out"): 1 | -1 | 0 {
  if (direction === "in" && IN_FLOWS.has(flowType)) return 1;
  if (direction === "out" && OUT_FLOWS.has(flowType)) return -1;
  // transfer / card_settlement are neutral to liquid-cash total: bank-leg out,
  // card-leg in — but cards aren't liquid kinds, so the bank-leg shows as
  // an outflow already from the txn ledger. Skip from forecast.
  return 0;
}

/**
 * Convert recurring rules + booked future txns into a deterministic stream of
 * scheduled flows between asOf and horizonEnd. For each rule we expand the
 * occurrences in the window; we drop any occurrence that's already been
 * settled by a recorded txn (greedy nearest-date match within ±14 days,
 * mirroring the obligations engine).
 */
export function buildScheduledFlows(input: FlowsBuildInput): ScheduledFlow[] {
  const out: ScheduledFlow[] = [];
  // Map ruleId → existing payment dates (for dedup).
  const paidByRule = new Map<string, string[]>();
  for (const t of input.ruleTxns) {
    if (t.isDeleted) continue;
    if (!t.recurringRuleId) continue;
    const list = paidByRule.get(t.recurringRuleId) ?? [];
    list.push(t.valueDate.slice(0, 10));
    paidByRule.set(t.recurringRuleId, list);
  }
  for (const rule of input.rules) {
    if (rule.status !== "active") continue;
    const occurrences = expectedOccurrences(
      rule,
      input.asOf,
      input.horizonEnd,
    );
    const paid = paidByRule.get(rule._id) ?? [];
    const consumed = new Set<number>();
    const tol = rule.frequency === "monthly" ? 14 : rule.frequency === "weekly" ? 3 : 0;
    for (const expected of occurrences) {
      // Greedy nearest-match: if a paid txn exists within tol days, skip.
      let best = -1;
      let bestDist = Infinity;
      paid.forEach((p, i) => {
        if (consumed.has(i)) return;
        const d = Math.abs(dateDelta(p, expected));
        if (d <= tol && d < bestDist) {
          best = i;
          bestDist = d;
        }
      });
      if (best >= 0) {
        consumed.add(best);
        continue;
      }
      const sign = signOf(rule.flowType, "out") === -1 ? -1 : signOf(rule.flowType, "in") === 1 ? 1 : 0;
      if (sign === 0) continue;
      out.push({
        date: expected,
        signedPaise: sign * rule.amountPaise,
        label: rule.label,
        source: "recurring",
      });
    }
  }
  // Booked future transactions: include directly.
  for (const t of input.bookedFutureTxns) {
    if (t.isDeleted) continue;
    if (t.valueDate < input.asOf || t.valueDate > input.horizonEnd) continue;
    const sign = signOf(t.flowType, t.direction);
    if (sign === 0) continue;
    out.push({
      date: t.valueDate.slice(0, 10),
      signedPaise: sign * t.amountPaise,
      label: t.flowType,
      source: "manual",
    });
  }
  return out;
}

function dateDelta(a: string, b: string): number {
  const da = new Date(`${a.slice(0, 10)}T00:00:00Z`).getTime();
  const db = new Date(`${b.slice(0, 10)}T00:00:00Z`).getTime();
  return Math.round((da - db) / 86400000);
}

/* ----------------------------------------------------------------------- */
/* Next-payday helper                                                       */
/* ----------------------------------------------------------------------- */

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

/** Resolve the next payday after `asOf` for a given month-day anchor. */
export function nextPaydayFrom(asOfIso: string, paydayDayOfMonth: number): string {
  const asOf = asOfIso.slice(0, 10);
  const [y, m] = asOf.split("-").map((s) => parseInt(s, 10)) as [number, number, number];
  const thisLast = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const thisClamped = Math.min(paydayDayOfMonth, thisLast);
  const target = `${y}-${pad2(m)}-${pad2(thisClamped)}`;
  if (target > asOf) return target;
  // Roll to next month
  const nextMonth = m === 12 ? 1 : m + 1;
  const nextYear = m === 12 ? y + 1 : y;
  // Clamp to end of next month for short months
  const lastDay = new Date(Date.UTC(nextYear, nextMonth, 0)).getUTCDate();
  const clamped = Math.min(paydayDayOfMonth, lastDay);
  return `${nextYear}-${pad2(nextMonth)}-${pad2(clamped)}`;
}

/** Previous payday on or before asOf (inclusive). Same clamping rules. */
export function priorPaydayFrom(asOfIso: string, paydayDayOfMonth: number): string {
  const asOf = asOfIso.slice(0, 10);
  const [y, m] = asOf.split("-").map((s) => parseInt(s, 10)) as [number, number, number];
  const thisMonthLast = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const thisMonth = `${y}-${pad2(m)}-${pad2(Math.min(paydayDayOfMonth, thisMonthLast))}`;
  if (thisMonth <= asOf) return thisMonth;
  const prevMonth = m === 1 ? 12 : m - 1;
  const prevYear = m === 1 ? y - 1 : y;
  const lastDay = new Date(Date.UTC(prevYear, prevMonth, 0)).getUTCDate();
  const clamped = Math.min(paydayDayOfMonth, lastDay);
  return `${prevYear}-${pad2(prevMonth)}-${pad2(clamped)}`;
}
