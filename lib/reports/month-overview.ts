import { Money } from "@/lib/money";
import {
  isSplitParentContainer,
  liveChildrenByParent,
} from "@/lib/balances/filters";
import type { TxnLite } from "@/lib/balances/types";
import type { FlowType } from "@/lib/schemas/common";
import { isInPeriod, type Period } from "./period";

export interface MonthOverviewInput {
  transactions: TxnLite[];
  period: Period;
}

export interface SpendBreakdown {
  need: number;
  want: number;
  unclassified: number;
  fee: number;
  total: number;
}

export interface MonthOverview {
  period: Period;
  txnCount: number;
  byFlowType: Record<FlowType, number>;
  spend: SpendBreakdown;
  income: number;
  familySupport: number;
  debtRepayment: number;
  investment: number;
  lendingOut: number;
  lendingRepaid: number;
  reimbursementIn: number;
  cardSettlement: number;
  transfer: number;
}

const ALL_FLOWS: FlowType[] = [
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

export function monthOverview(input: MonthOverviewInput): MonthOverview {
  const { transactions, period } = input;
  const childrenByParent = liveChildrenByParent(transactions);

  const byFlowType: Record<FlowType, Money> = {} as Record<FlowType, Money>;
  for (const f of ALL_FLOWS) byFlowType[f] = Money.zero();
  const spendNeed = { paise: 0 };
  const spendWant = { paise: 0 };
  const spendNone = { paise: 0 };
  let txnCount = 0;

  for (const t of transactions) {
    if (t.isDeleted) continue;
    if (isSplitParentContainer(t, childrenByParent)) continue;
    if (!isInPeriod(t.valueDate, period)) continue;
    txnCount++;
    // SplitBill source spend: re-attribute amounts so reports treat only the
    // owner's share as spend; the rest flows into lending_out exposure.
    if (
      t.flowType === "spend" &&
      typeof t.splitOwnSharePaise === "number"
    ) {
      const own = Math.max(0, Math.min(t.splitOwnSharePaise, t.amountPaise));
      const others = t.amountPaise - own;
      byFlowType.spend = byFlowType.spend.add(Money.fromPaise(own));
      if (others > 0) {
        byFlowType.lending_out = byFlowType.lending_out.add(Money.fromPaise(others));
      }
      const nw = (t as TxnLite & { needWant?: "need" | "want" }).needWant;
      if (nw === "need") spendNeed.paise += own;
      else if (nw === "want") spendWant.paise += own;
      else spendNone.paise += own;
      continue;
    }
    byFlowType[t.flowType] = byFlowType[t.flowType].add(Money.fromPaise(t.amountPaise));
    if (t.flowType === "spend") {
      const nw = (t as TxnLite & { needWant?: "need" | "want" }).needWant;
      if (nw === "need") spendNeed.paise += t.amountPaise;
      else if (nw === "want") spendWant.paise += t.amountPaise;
      else spendNone.paise += t.amountPaise;
    }
  }

  const spendTotal = spendNeed.paise + spendWant.paise + spendNone.paise;
  const feeTotal = byFlowType.fee.paise;

  return {
    period,
    txnCount,
    byFlowType: Object.fromEntries(
      ALL_FLOWS.map((f) => [f, byFlowType[f].paise]),
    ) as Record<FlowType, number>,
    spend: {
      need: spendNeed.paise,
      want: spendWant.paise,
      unclassified: spendNone.paise,
      fee: feeTotal,
      total: spendTotal,
    },
    income: byFlowType.income.paise,
    familySupport: byFlowType.family_support.paise,
    debtRepayment: byFlowType.debt_repayment.paise,
    investment: byFlowType.investment.paise,
    lendingOut: byFlowType.lending_out.paise,
    lendingRepaid: byFlowType.lending_repaid.paise,
    reimbursementIn: byFlowType.reimbursement_in.paise,
    cardSettlement: byFlowType.card_settlement.paise,
    transfer: byFlowType.transfer.paise,
  };
}
