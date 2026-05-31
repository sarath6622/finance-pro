import { accountBalanceAt } from "@/lib/balances/compute";
import type { AccountLite, TxnLite } from "@/lib/balances/types";
import {
  loanOutstandingAt,
  type LoanAccountLite,
} from "@/lib/projection/loan-balance";
import { computeOutstanding } from "@/lib/receivables/apply-repayment";
import type { ReceivableLite, RepaymentLite } from "@/lib/receivables/types";
import type { HoldingLite } from "@/lib/holdings/types";
import { buildPortfolioSnapshot } from "@/lib/holdings/valuation";

export interface NetWorthInput {
  asOf: string;
  accounts: Array<
    AccountLite & {
      name: string;
      kind: "bank" | "credit_card" | "cash" | "investment" | "loan" | "wallet";
      interestRatePA?: number;
      emiAmountPaise?: number;
    }
  >;
  transactions: TxnLite[];
  receivables: ReceivableLite[];
  repaymentsByReceivable: Map<string, RepaymentLite[]>;
  /** Tracked holdings (crypto/stocks/MFs). When provided, their live (or last-known)
   *  market value replaces the `investment`-kind account balance contribution. */
  holdings?: HoldingLite[];
}

export interface NetWorthAssetLine {
  accountId: string;
  name: string;
  kind: "bank" | "cash" | "investment" | "wallet";
  paise: number;
}
export interface NetWorthLiabilityLine {
  accountId: string;
  name: string;
  kind: "credit_card" | "loan";
  paise: number;
  emiPaise?: number;
  interestRatePA?: number;
}

export interface NetWorthReport {
  asOf: string;
  assets: {
    cashPaise: number;
    investmentPaise: number;
    receivablesPaise: number;
    totalPaise: number;
    perAccount: NetWorthAssetLine[];
  };
  liabilities: {
    cardPaise: number;
    loanPaise: number;
    totalPaise: number;
    perAccount: NetWorthLiabilityLine[];
  };
  netWorthPaise: number;
  /** True only while P8 hasn't shipped holdings; resolves to false once holdings replace the
   *  investment-account balance contribution. */
  isInvestmentPartial: boolean;
  /** When holdings were provided, the count of holdings whose price is older than the stale
   *  window — feeds an "as of" warning on the dashboard tile (E36). */
  stalePriceCount?: number;
}

const ASSET_KINDS = new Set(["bank", "cash", "investment", "wallet"]);

/**
 * Compute net worth from already-fetched data. Pure: deterministic given
 * inputs, no I/O. Investments are accounted for at *account balance* until
 * P8 ships holdings — flagged via `isInvestmentPartial`.
 */
export function buildNetWorth(input: NetWorthInput): NetWorthReport {
  const { asOf, accounts, transactions, receivables, repaymentsByReceivable, holdings } = input;
  const assetsPer: NetWorthAssetLine[] = [];
  const liabPer: NetWorthLiabilityLine[] = [];
  let cash = 0;
  let inv = 0;
  let card = 0;
  let loan = 0;

  const useHoldingsForInvestments = !!holdings;

  for (const a of accounts) {
    if (a.kind === "loan") {
      const loanLite: LoanAccountLite = {
        _id: a._id,
        openingBalancePaise: a.openingBalancePaise,
        ...(a.interestRatePA !== undefined ? { interestRatePA: a.interestRatePA } : {}),
        ...(a.emiAmountPaise !== undefined ? { emiPaise: a.emiAmountPaise } : {}),
      };
      const outstanding = loanOutstandingAt(loanLite, transactions, asOf);
      liabPer.push({
        accountId: a._id,
        name: a.name,
        kind: "loan",
        paise: outstanding,
        ...(a.emiAmountPaise !== undefined ? { emiPaise: a.emiAmountPaise } : {}),
        ...(a.interestRatePA !== undefined ? { interestRatePA: a.interestRatePA } : {}),
      });
      loan += outstanding;
      continue;
    }
    // For cards and asset accounts, derive balance from ledger.
    const bal = accountBalanceAt(a._id, {
      transactions,
      accounts: [a],
      cutoff: asOf,
    }).ownerPerspectivePaise;
    if (a.kind === "credit_card") {
      const owed = Math.max(0, -bal);
      liabPer.push({ accountId: a._id, name: a.name, kind: "credit_card", paise: owed });
      card += owed;
      continue;
    }
    if (ASSET_KINDS.has(a.kind)) {
      const positive = Math.max(0, bal);
      // When holdings are provided, skip the `investment` account balance — its
      // economic value is captured by holdings market value instead. The ledger
      // balance of investment accounts is a sunk-cost-style number that
      // double-counts buys.
      if (a.kind === "investment" && useHoldingsForInvestments) {
        continue;
      }
      assetsPer.push({
        accountId: a._id,
        name: a.name,
        kind: a.kind as NetWorthAssetLine["kind"],
        paise: positive,
      });
      if (a.kind === "investment") inv += positive;
      else cash += positive;
    }
  }

  // Holdings live valuation (FR-41).
  let stalePriceCount: number | undefined;
  if (useHoldingsForInvestments && holdings) {
    const snap = buildPortfolioSnapshot(holdings, { asOf });
    inv = snap.totals.marketValuePaise;
    stalePriceCount = snap.totals.stalePriceCount;
    // Surface each holding as a per-account line so the dashboard breakdown stays consistent.
    for (const v of snap.holdings) {
      const h = holdings.find((x) => x._id === v.holdingId);
      if (!h) continue;
      assetsPer.push({
        accountId: v.holdingId,
        name: `${h.symbol} (${h.platform})`,
        kind: "investment",
        paise: v.marketValuePaise,
      });
    }
  }

  // Receivables: outstanding only (non-written-off, non-deleted).
  let receivablesTotal = 0;
  for (const r of receivables) {
    if (r.isDeleted) continue;
    if (r.status === "written_off") continue;
    const reps = repaymentsByReceivable.get(r._id) ?? [];
    const { outstandingPaise } = computeOutstanding(r, reps);
    receivablesTotal += outstandingPaise;
  }

  const totalAssets = cash + inv + receivablesTotal;
  const totalLiabilities = card + loan;
  return {
    asOf,
    assets: {
      cashPaise: cash,
      investmentPaise: inv,
      receivablesPaise: receivablesTotal,
      totalPaise: totalAssets,
      perAccount: assetsPer,
    },
    liabilities: {
      cardPaise: card,
      loanPaise: loan,
      totalPaise: totalLiabilities,
      perAccount: liabPer,
    },
    netWorthPaise: totalAssets - totalLiabilities,
    isInvestmentPartial: !useHoldingsForInvestments,
    ...(stalePriceCount !== undefined ? { stalePriceCount } : {}),
  };
}
