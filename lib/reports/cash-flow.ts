import type { TxnLite } from "@/lib/balances/types";
import {
  isSplitParentContainer,
  liveChildrenByParent,
} from "@/lib/balances/filters";
import type { FlowType } from "@/lib/schemas/common";
import { isInPeriod, type Period } from "./period";

export interface CashFlowInput {
  transactions: TxnLite[];
  period: Period;
}

export interface CashFlowBucket {
  inflowPaise: number;
  outflowPaise: number;
  netPaise: number;
}

export interface CashFlowResult {
  period: Period;
  txnCount: number;
  perFlowType: Record<FlowType, CashFlowBucket>;
  /** "True" cash flow excluding transfer + card_settlement (neutral, double-counted otherwise) */
  trueInflowPaise: number;
  trueOutflowPaise: number;
  netCashFlowPaise: number;
  /** Sum across all flows (incl. transfers) — sanity row */
  totalInflowPaise: number;
  totalOutflowPaise: number;
}

const NEUTRAL_FLOWS = new Set<FlowType>(["transfer", "card_settlement"]);

function emptyBucket(): CashFlowBucket {
  return { inflowPaise: 0, outflowPaise: 0, netPaise: 0 };
}

/**
 * R8 — Cash flow statement.
 *
 * For each FlowType in the period, sum inflow vs outflow. "True" cash flow
 * excludes neutral flows (transfer between own accounts, card_settlement)
 * since they don't change net liquid position.
 *
 * SplitBill source spend: only the owner's portion is true spend; the rest
 * is owed to the owner. We use `splitOwnSharePaise` to re-attribute (matches
 * monthOverview behaviour).
 */
export function cashFlow(input: CashFlowInput): CashFlowResult {
  const { transactions, period } = input;
  const childrenByParent = liveChildrenByParent(transactions);
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
  const perFlow: Record<FlowType, CashFlowBucket> = {} as Record<FlowType, CashFlowBucket>;
  for (const f of ALL_FLOWS) perFlow[f] = emptyBucket();
  let txnCount = 0;
  let trueIn = 0;
  let trueOut = 0;
  let totalIn = 0;
  let totalOut = 0;

  for (const t of transactions) {
    if (t.isDeleted) continue;
    if (isSplitParentContainer(t, childrenByParent)) continue;
    if (!isInPeriod(t.valueDate, period)) continue;
    txnCount += 1;

    // Default amounts:
    const inflow = t.direction === "in" ? t.amountPaise : 0;
    const outflow = t.direction === "out" ? t.amountPaise : 0;
    const bucketKey: FlowType = t.flowType;

    // Split bill re-attribution: owner's share counts in spend bucket; the
    // rest flows into lending_out (so it doesn't double-count as true spend).
    if (t.flowType === "spend" && typeof t.splitOwnSharePaise === "number") {
      const own = Math.max(0, Math.min(t.splitOwnSharePaise, t.amountPaise));
      const others = t.amountPaise - own;
      perFlow.spend.outflowPaise += own;
      perFlow.spend.netPaise -= own;
      if (others > 0) {
        perFlow.lending_out.outflowPaise += others;
        perFlow.lending_out.netPaise -= others;
      }
      totalOut += t.amountPaise;
      if (!NEUTRAL_FLOWS.has(bucketKey)) trueOut += t.amountPaise;
      continue;
    }

    perFlow[bucketKey].inflowPaise += inflow;
    perFlow[bucketKey].outflowPaise += outflow;
    perFlow[bucketKey].netPaise += inflow - outflow;
    totalIn += inflow;
    totalOut += outflow;
    if (!NEUTRAL_FLOWS.has(bucketKey)) {
      trueIn += inflow;
      trueOut += outflow;
    }
  }

  return {
    period,
    txnCount,
    perFlowType: perFlow,
    trueInflowPaise: trueIn,
    trueOutflowPaise: trueOut,
    netCashFlowPaise: trueIn - trueOut,
    totalInflowPaise: totalIn,
    totalOutflowPaise: totalOut,
  };
}
