import type { QueryClient } from "@tanstack/react-query";

const LEDGER_KEYS = [
  "transactions",
  "accounts",
  "receivables",
  "splits",
  "reports",
  "holdings",
  "obligations",
  "budgets",
  "debts",
  "liquidity",
  "recurring",
] as const;

export function invalidateLedger(qc: QueryClient) {
  for (const key of LEDGER_KEYS) {
    qc.invalidateQueries({ queryKey: [key] });
  }
}
