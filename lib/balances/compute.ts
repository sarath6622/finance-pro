import { Money } from "@/lib/money";
import type { FlowType } from "@/lib/schemas/common";
import {
  isActiveTxn,
  isOnOrAfterOpening,
  isSplitParentContainer,
  isWithinCutoff,
  liveChildrenByParent,
} from "./filters";
import {
  SPEND_FLOW_TYPES,
  signedDelta,
} from "./flow-rules";
import type { AccountBalance, AccountLite, BalanceInput, TxnLite } from "./types";

function indexAccounts(accounts: AccountLite[]): Map<string, AccountLite> {
  return new Map(accounts.map((a) => [a._id, a]));
}

function ymd(input?: string): string {
  if (!input) return new Date().toISOString().slice(0, 10);
  return input.slice(0, 10);
}

interface BalanceCtx {
  childrenByParent: Map<string, TxnLite[]>;
  accountsById: Map<string, AccountLite>;
  cutoff?: string;
}

function makeCtx(input: BalanceInput): BalanceCtx {
  return {
    childrenByParent: liveChildrenByParent(input.transactions),
    accountsById: indexAccounts(input.accounts),
    cutoff: input.cutoff,
  };
}

function passes(txn: TxnLite, ctx: BalanceCtx, account?: AccountLite): boolean {
  if (!isActiveTxn(txn)) return false;
  if (isSplitParentContainer(txn, ctx.childrenByParent)) return false;
  if (!isWithinCutoff(txn, ctx.cutoff)) return false;
  if (account && !isOnOrAfterOpening(txn, account.openingDate)) return false;
  return true;
}

export function accountBalanceAt(accountId: string, input: BalanceInput): AccountBalance {
  const ctx = makeCtx(input);
  const account = ctx.accountsById.get(accountId);
  if (!account) {
    throw new Error(`Unknown accountId: ${accountId}`);
  }
  let balance = account.openingBalancePaise;
  for (const t of input.transactions) {
    if (t.accountId !== accountId) continue;
    if (!passes(t, ctx, account)) continue;
    balance += signedDelta(t, account).paise;
  }
  return {
    accountId,
    classification: account.classification,
    ownerPerspectivePaise: balance,
    asOf: ymd(input.cutoff),
  };
}

export function allAccountBalances(input: BalanceInput): AccountBalance[] {
  return input.accounts.map((a) => accountBalanceAt(a._id, input));
}

/**
 * Per-row closing balance for the account drill-in list view.
 *
 * Walks a descending-by-time list of an account's transactions
 * (newest first — the order the UI already shows) and anchors the
 * topmost row's post-balance to `currentBalancePaise`. Each older row
 * gets the previous running balance minus its delta.
 *
 * Anchoring at the current balance means the function works even
 * when the list is paginated — we never need to load every txn back
 * to the account's opening. Soft-deleted and split-parent rows are
 * skipped (they don't move the balance); they have no entry in the
 * map and the UI shows "—" for them.
 *
 * The list MUST be passed in descending chronological order and MUST
 * contain only one account's transactions, otherwise the math is
 * wrong. Caller is expected to filter and sort.
 */
export function runningBalancesFromAnchor(
  descendingTxns: TxnLite[],
  currentBalancePaise: number,
  account: AccountLite,
): Map<string, number> {
  const childrenByParent = liveChildrenByParent(descendingTxns);
  const out = new Map<string, number>();
  let running = currentBalancePaise;
  for (const t of descendingTxns) {
    if (!isActiveTxn(t)) continue;
    if (isSplitParentContainer(t, childrenByParent)) continue;
    out.set(t._id, running);
    running -= signedDelta(t, account).paise;
  }
  return out;
}

export function accountTimeSeries(
  accountId: string,
  input: BalanceInput,
  granularity: "day" | "month",
): Array<{ date: string; paise: number }> {
  const ctx = makeCtx(input);
  const account = ctx.accountsById.get(accountId);
  if (!account) throw new Error(`Unknown accountId: ${accountId}`);

  const buckets = new Map<string, number>();
  for (const t of input.transactions) {
    if (t.accountId !== accountId) continue;
    if (!passes(t, ctx, account)) continue;
    const key = granularity === "month" ? t.valueDate.slice(0, 7) : t.valueDate;
    buckets.set(key, (buckets.get(key) ?? 0) + signedDelta(t, account).paise);
  }
  const sortedKeys = [...buckets.keys()].sort();
  let running = account.openingBalancePaise;
  return sortedKeys.map((date) => {
    running += buckets.get(date) ?? 0;
    return { date, paise: running };
  });
}

export interface SpendTotalOpts {
  includeFees?: boolean;
}

/**
 * When a `spend` txn is the source of a SplitBill, only `splitOwnSharePaise`
 * is true spend — the rest is owed to the owner by others (split_iou).
 */
function effectiveSpendPaise(t: TxnLite): number {
  if (t.flowType !== "spend") return t.amountPaise;
  if (typeof t.splitOwnSharePaise === "number") {
    return Math.max(0, Math.min(t.splitOwnSharePaise, t.amountPaise));
  }
  return t.amountPaise;
}

export function spendTotal(input: BalanceInput, opts: SpendTotalOpts = {}): Money {
  const { includeFees = true } = opts;
  const ctx = makeCtx(input);
  let acc = Money.zero();
  for (const t of input.transactions) {
    if (!passes(t, ctx)) continue;
    if (!SPEND_FLOW_TYPES.has(t.flowType)) continue;
    if (!includeFees && t.flowType === "fee") continue;
    acc = acc.add(Money.fromPaise(effectiveSpendPaise(t)));
  }
  return acc;
}

export function flowTotals(input: BalanceInput): Record<FlowType, Money> {
  const ctx = makeCtx(input);
  const totals: Partial<Record<FlowType, Money>> = {};
  for (const t of input.transactions) {
    if (!passes(t, ctx)) continue;
    if (t.flowType === "spend" && typeof t.splitOwnSharePaise === "number") {
      const own = Math.max(0, Math.min(t.splitOwnSharePaise, t.amountPaise));
      const others = t.amountPaise - own;
      totals.spend = (totals.spend ?? Money.zero()).add(Money.fromPaise(own));
      if (others > 0) {
        totals.lending_out =
          (totals.lending_out ?? Money.zero()).add(Money.fromPaise(others));
      }
      continue;
    }
    totals[t.flowType] = (totals[t.flowType] ?? Money.zero()).add(Money.fromPaise(t.amountPaise));
  }
  const allFlows: FlowType[] = [
    "spend",
    "income",
    "family_support",
    "investment",
    "debt_repayment",
    "lending_out",
    "lending_repaid",
    "reimbursement_in",
    "card_settlement",
    "transfer",
    "fee",
  ];
  const out = {} as Record<FlowType, Money>;
  for (const f of allFlows) out[f] = totals[f] ?? Money.zero();
  return out;
}
