import { Money } from "@/lib/money";
import type { FlowType, TxnDirection } from "@/lib/schemas/common";
import type { AccountLite, TxnLite } from "./types";

export const SPEND_FLOW_TYPES: ReadonlySet<FlowType> = new Set<FlowType>(["spend", "fee"]);

export const PASS_THROUGH_FLOW_TYPES: ReadonlySet<FlowType> = new Set<FlowType>([
  "card_settlement",
  "transfer",
  "lending_out",
  "lending_repaid",
  "reimbursement_in",
  "investment",
  "family_support",
  "debt_repayment",
]);

export function flowAffectsSpending(ft: FlowType): boolean {
  return SPEND_FLOW_TYPES.has(ft);
}

export function flowAffectsNetWorth(ft: FlowType): boolean {
  return ft === "spend" || ft === "income" || ft === "fee";
}

const IN_FLOWS: ReadonlySet<FlowType> = new Set<FlowType>([
  "income",
  "lending_repaid",
  "reimbursement_in",
]);

export function expectedDirection(ft: FlowType): TxnDirection | "either" {
  if (IN_FLOWS.has(ft)) return "in";
  // transfer / card_settlement: legs can be either side
  // investment: buy = out (cash → asset), sell = in (asset → cash)
  if (ft === "transfer" || ft === "card_settlement" || ft === "investment") {
    return "either";
  }
  return "out";
}

export function signedDelta(txn: TxnLite, _account: AccountLite): Money {
  const sign = txn.direction === "in" ? 1 : -1;
  return Money.fromPaise(sign * txn.amountPaise);
}
