/**
 * Strip server-derived fields before persisting to idb.
 *
 * CLAUDE.md invariant #2: balances are *derived*, never stored as
 * authority. Persisting a server-computed `balancePaise` would let an
 * offline UI replay drift from truth — the local mirror keeps only
 * the inputs (transactions) and re-derives on render.
 */

import type { ApiAccount } from "@/lib/api/types";

export function stripAccountBalance(account: ApiAccount): ApiAccount {
  const { balancePaise: _ignored, ...rest } = account;
  return rest as ApiAccount;
}

export function stripAccountBalances(accounts: ApiAccount[]): ApiAccount[] {
  return accounts.map(stripAccountBalance);
}
