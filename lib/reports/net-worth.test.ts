import { describe, expect, it } from "vitest";
import { buildNetWorth } from "./net-worth";
import type { TxnLite } from "@/lib/balances/types";
import type { ReceivableLite, RepaymentLite } from "@/lib/receivables/types";

const ASOF = "2026-06-01";

function acct(
  id: string,
  kind: "bank" | "credit_card" | "cash" | "investment" | "loan" | "wallet",
  opening: number,
  extras: Partial<{ interestRatePA: number; emiAmountPaise: number }> = {},
) {
  return {
    _id: id,
    name: id,
    kind,
    classification: kind === "credit_card" || kind === "loan" ? ("liability" as const) : ("asset" as const),
    openingBalancePaise: opening,
    ...extras,
  };
}

function txn(
  id: string,
  accountId: string,
  flowType: TxnLite["flowType"],
  direction: TxnLite["direction"],
  paise: number,
  date: string,
  extras: Partial<TxnLite> = {},
): TxnLite {
  return {
    _id: id,
    accountId,
    flowType,
    direction,
    amountPaise: paise,
    valueDate: date,
    isDeleted: false,
    ...extras,
  };
}

describe("buildNetWorth (R11 partial)", () => {
  it("computes assets, liabilities, and net worth with no debt", () => {
    const accounts = [
      acct("bank", "bank", 5000000), // ₹50,000
      acct("inv", "investment", 1000000),
      acct("card", "credit_card", 0),
    ];
    const txns: TxnLite[] = [
      txn("t1", "bank", "spend", "out", 100000, "2026-05-10"),
      txn("t2", "card", "spend", "out", 200000, "2026-05-11"),
    ];
    const report = buildNetWorth({
      asOf: ASOF,
      accounts,
      transactions: txns,
      receivables: [],
      repaymentsByReceivable: new Map(),
    });
    expect(report.assets.cashPaise).toBe(5000000 - 100000);
    expect(report.assets.investmentPaise).toBe(1000000);
    expect(report.liabilities.cardPaise).toBe(200000);
    expect(report.netWorthPaise).toBe(5000000 - 100000 + 1000000 - 200000);
    expect(report.isInvestmentPartial).toBe(true);
  });

  it("loan account outstanding decreases by principal portion of debt_repayment txns", () => {
    const accounts = [
      acct("bank", "bank", 10000000),
      acct("loan", "loan", 1000000, { interestRatePA: 12, emiAmountPaise: 100000 }),
    ];
    // Two EMI payments — ₹1,000 each, with interest portions ₹100 and ₹90
    const txns: TxnLite[] = [
      txn("t1", "bank", "debt_repayment", "out", 100000, "2026-05-05", {
        debtAccountId: "loan",
        interestPortionPaise: 10000,
      }),
      txn("t2", "bank", "debt_repayment", "out", 100000, "2026-06-05", {
        debtAccountId: "loan",
        interestPortionPaise: 9000,
      }),
    ];
    const report = buildNetWorth({
      asOf: ASOF,
      accounts,
      transactions: txns,
      receivables: [],
      repaymentsByReceivable: new Map(),
    });
    // asOf=2026-06-01 excludes the June 5 txn (dated > cutoff).
    // Only the May 5 EMI counts: 1,000,000 − (100,000 − 10,000) = 910,000.
    expect(report.liabilities.loanPaise).toBe(910000);
  });

  it("excludes loan txns dated after asOf (cutoff)", () => {
    const accounts = [
      acct("bank", "bank", 10000000),
      acct("loan", "loan", 1000000, { interestRatePA: 12 }),
    ];
    const txns: TxnLite[] = [
      txn("t1", "bank", "debt_repayment", "out", 100000, "2026-04-05", {
        debtAccountId: "loan",
        interestPortionPaise: 10000,
      }),
      txn("t2", "bank", "debt_repayment", "out", 100000, "2026-07-05", {
        debtAccountId: "loan",
        interestPortionPaise: 9000,
      }),
    ];
    const report = buildNetWorth({
      asOf: "2026-05-01",
      accounts,
      transactions: txns,
      receivables: [],
      repaymentsByReceivable: new Map(),
    });
    // Only April txn applies: 1,000,000 − 90,000 = 910,000
    expect(report.liabilities.loanPaise).toBe(910000);
  });

  it("receivables outstanding rolls into assets; written_off and soft-deleted excluded", () => {
    const recs: ReceivableLite[] = [
      {
        _id: "r1",
        counterpartyId: "cp1",
        kind: "cash_loan",
        principalPaise: 50000,
        dateIncurred: "2026-05-01",
        dueModel: "on_date",
        status: "open",
        repaymentTxnIds: [],
      },
      {
        _id: "r2",
        counterpartyId: "cp1",
        kind: "split_iou",
        principalPaise: 30000,
        dateIncurred: "2026-05-01",
        dueModel: "when_able",
        status: "written_off",
        repaymentTxnIds: [],
      },
    ];
    const reps: RepaymentLite[] = [
      {
        _id: "rep1",
        receivableId: "r1",
        valueDate: "2026-05-10",
        amountPaise: 10000,
        isDeleted: false,
        flowType: "lending_repaid",
      },
    ];
    const report = buildNetWorth({
      asOf: ASOF,
      accounts: [acct("bank", "bank", 1000000)],
      transactions: [],
      receivables: recs,
      repaymentsByReceivable: new Map([["r1", reps]]),
    });
    // 50,000 - 10,000 = 40,000 outstanding for r1; r2 written_off excluded.
    expect(report.assets.receivablesPaise).toBe(40000);
  });
});
