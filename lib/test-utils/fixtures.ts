import type { AccountLite, TxnLite } from "@/lib/balances/types";

let oidCounter = 1;
export function mkOid(): string {
  const hex = (oidCounter++).toString(16).padStart(24, "0");
  return hex;
}

export function resetOidCounter(): void {
  oidCounter = 1;
}

export function mkAccount(overrides: Partial<AccountLite> = {}): AccountLite {
  return {
    _id: mkOid(),
    classification: "asset",
    openingBalancePaise: 0,
    ...overrides,
  };
}

export function mkTxn(overrides: Partial<TxnLite> & { accountId: string }): TxnLite {
  return {
    _id: mkOid(),
    valueDate: "2026-05-30",
    flowType: "spend",
    direction: "out",
    amountPaise: 10000,
    isDeleted: false,
    ...overrides,
  };
}
