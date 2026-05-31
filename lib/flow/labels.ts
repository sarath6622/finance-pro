import type { FlowType, TxnDirection } from "@/lib/schemas/common";
import { expectedDirection } from "@/lib/balances/flow-rules";

export function flowTypeLabel(ft: FlowType): string {
  const map: Record<FlowType, string> = {
    spend: "Spend",
    income: "Income",
    family_support: "Family",
    investment: "Invest",
    debt_repayment: "EMI",
    lending_out: "Lend out",
    lending_repaid: "Repaid",
    reimbursement_in: "Reimburs.",
    card_settlement: "Card pay",
    transfer: "Transfer",
    fee: "Fee",
  };
  return map[ft];
}

export function defaultDirectionFor(ft: FlowType): TxnDirection {
  const d = expectedDirection(ft);
  return d === "either" ? "out" : d;
}
