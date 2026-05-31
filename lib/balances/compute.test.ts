import { beforeEach, describe, expect, it } from "vitest";
import {
  accountBalanceAt,
  accountTimeSeries,
  allAccountBalances,
  flowTotals,
  spendTotal,
} from "./compute";
import type { AccountLite, TxnLite } from "./types";
import { mkAccount, mkTxn, resetOidCounter } from "@/lib/test-utils/fixtures";

beforeEach(() => {
  resetOidCounter();
});

describe("E1 — split parent excluded; children counted", () => {
  it("a single ₹60k parent with 3 children is not double-counted", () => {
    const bank = mkAccount({ openingBalancePaise: 10000000 });
    const parent = mkTxn({
      accountId: bank._id,
      _id: "parent-60k",
      amountPaise: 6000000,
      flowType: "spend",
      direction: "out",
    });
    const c1 = mkTxn({
      accountId: bank._id,
      parentTransactionId: "parent-60k",
      amountPaise: 2500000,
      flowType: "family_support",
      direction: "out",
    });
    const c2 = mkTxn({
      accountId: bank._id,
      parentTransactionId: "parent-60k",
      amountPaise: 2500000,
      flowType: "family_support",
      direction: "out",
    });
    const c3 = mkTxn({
      accountId: bank._id,
      parentTransactionId: "parent-60k",
      amountPaise: 1000000,
      flowType: "debt_repayment",
      direction: "out",
    });
    const input = { transactions: [parent, c1, c2, c3], accounts: [bank] };
    const bal = accountBalanceAt(bank._id, input);
    expect(bal.ownerPerspectivePaise).toBe(10000000 - 6000000);
    expect(spendTotal(input).paise).toBe(0);
    const totals = flowTotals(input);
    expect(totals.family_support.paise).toBe(5000000);
    expect(totals.debt_repayment.paise).toBe(1000000);
    expect(totals.spend.paise).toBe(0);
  });

  it("parent re-enters totals if all children deleted", () => {
    const bank = mkAccount({ openingBalancePaise: 10000000 });
    const parent = mkTxn({
      accountId: bank._id,
      _id: "p-zero-kids",
      amountPaise: 1000000,
      flowType: "spend",
      direction: "out",
    });
    const c = mkTxn({
      accountId: bank._id,
      parentTransactionId: "p-zero-kids",
      amountPaise: 1000000,
      isDeleted: true,
    });
    const input = { transactions: [parent, c], accounts: [bank] };
    expect(accountBalanceAt(bank._id, input).ownerPerspectivePaise).toBe(9000000);
  });
});

describe("E4 — credit-card charge vs settlement (FR-8)", () => {
  it("spend on card increases card liability and does not touch bank cash", () => {
    const bank = mkAccount({ _id: "b", openingBalancePaise: 10000000 });
    const card = mkAccount({
      _id: "c",
      classification: "liability",
      openingBalancePaise: -2500000,
    });
    const charge = mkTxn({
      accountId: card._id,
      flowType: "spend",
      direction: "out",
      amountPaise: 50000,
    });
    const input = { transactions: [charge], accounts: [bank, card] };
    expect(accountBalanceAt(bank._id, input).ownerPerspectivePaise).toBe(10000000);
    expect(accountBalanceAt(card._id, input).ownerPerspectivePaise).toBe(-2550000);
    expect(spendTotal(input).paise).toBe(50000);
  });

  it("settlement reduces both bank cash and card liability, with zero spend impact", () => {
    const bank = mkAccount({ _id: "b2", openingBalancePaise: 10000000 });
    const card = mkAccount({
      _id: "c2",
      classification: "liability",
      openingBalancePaise: -2500000,
    });
    const charge = mkTxn({
      accountId: card._id,
      flowType: "spend",
      direction: "out",
      amountPaise: 50000,
    });
    const legBank = mkTxn({
      accountId: bank._id,
      flowType: "card_settlement",
      direction: "out",
      amountPaise: 2500000,
    });
    const legCard = mkTxn({
      accountId: card._id,
      flowType: "card_settlement",
      direction: "in",
      amountPaise: 2500000,
    });
    const input = { transactions: [charge, legBank, legCard], accounts: [bank, card] };
    expect(accountBalanceAt(bank._id, input).ownerPerspectivePaise).toBe(7500000);
    expect(accountBalanceAt(card._id, input).ownerPerspectivePaise).toBe(-50000);
    expect(spendTotal(input).paise).toBe(50000);
  });
});

describe("E13 — edits cascade automatically because balances derive", () => {
  it("modifying amountPaise produces a new balance with no extra write needed", () => {
    const bank = mkAccount({ openingBalancePaise: 0 });
    const t = mkTxn({
      accountId: bank._id,
      amountPaise: 100000,
      direction: "out",
      flowType: "spend",
      valueDate: "2025-03-15",
    });
    const before = accountBalanceAt(bank._id, { transactions: [t], accounts: [bank] });
    expect(before.ownerPerspectivePaise).toBe(-100000);
    const tEdited: TxnLite = { ...t, amountPaise: 200000 };
    const after = accountBalanceAt(bank._id, {
      transactions: [tEdited],
      accounts: [bank],
    });
    expect(after.ownerPerspectivePaise).toBe(-200000);
  });

  it("soft-deleted transactions are excluded", () => {
    const bank = mkAccount({ openingBalancePaise: 0 });
    const t = mkTxn({
      accountId: bank._id,
      amountPaise: 100000,
      direction: "out",
      flowType: "spend",
      isDeleted: true,
    });
    const bal = accountBalanceAt(bank._id, { transactions: [t], accounts: [bank] });
    expect(bal.ownerPerspectivePaise).toBe(0);
  });
});

describe("E17 — paise integer reducer doesn't drift", () => {
  it("sums 1000 transactions of 50_01 paise exactly", () => {
    const bank = mkAccount({ openingBalancePaise: 0 });
    const txns: TxnLite[] = [];
    for (let i = 0; i < 1000; i++) {
      txns.push(
        mkTxn({
          accountId: bank._id,
          amountPaise: 5001,
          direction: "in",
          flowType: "income",
        }),
      );
    }
    const bal = accountBalanceAt(bank._id, { transactions: txns, accounts: [bank] });
    expect(bal.ownerPerspectivePaise).toBe(5001 * 1000);
  });
});

describe("E18 — self-transfer nets to zero across all accounts", () => {
  it("two transfer legs sum to zero across asset accounts", () => {
    const bank = mkAccount({ _id: "tb", openingBalancePaise: 10000000 });
    const cash = mkAccount({ _id: "tc", openingBalancePaise: 0 });
    const legOut = mkTxn({
      accountId: bank._id,
      flowType: "transfer",
      direction: "out",
      amountPaise: 500000,
    });
    const legIn = mkTxn({
      accountId: cash._id,
      flowType: "transfer",
      direction: "in",
      amountPaise: 500000,
    });
    const input = { transactions: [legOut, legIn], accounts: [bank, cash] };
    const balances = allAccountBalances(input);
    const bb = balances.find((b) => b.accountId === "tb")!.ownerPerspectivePaise;
    const cb = balances.find((b) => b.accountId === "tc")!.ownerPerspectivePaise;
    expect(bb).toBe(9500000);
    expect(cb).toBe(500000);
    expect(bb + cb).toBe(10000000);
    expect(spendTotal(input).paise).toBe(0);
    expect(flowTotals(input).transfer.paise).toBe(1000000);
  });
});

describe("E19 — cutoff uses valueDate, not bookedAt", () => {
  it("cutoff inclusive: txn dated 2026-05-30 is in for cutoff=2026-05-30", () => {
    const bank = mkAccount({ openingBalancePaise: 0 });
    const t = mkTxn({
      accountId: bank._id,
      valueDate: "2026-05-30",
      flowType: "income",
      direction: "in",
      amountPaise: 100000,
    });
    const balOn = accountBalanceAt(bank._id, {
      transactions: [t],
      accounts: [bank],
      cutoff: "2026-05-30",
    });
    const balBefore = accountBalanceAt(bank._id, {
      transactions: [t],
      accounts: [bank],
      cutoff: "2026-05-29",
    });
    expect(balOn.ownerPerspectivePaise).toBe(100000);
    expect(balBefore.ownerPerspectivePaise).toBe(0);
  });
});

describe("E23 — opening balance + opening date respected", () => {
  it("pre-opening txns are ignored; cutoff at opening returns opening exactly", () => {
    const bank = mkAccount({
      _id: "ba",
      openingBalancePaise: 5000000,
      openingDate: "2026-04-01",
    });
    const preOpening = mkTxn({
      accountId: bank._id,
      valueDate: "2026-03-15",
      flowType: "spend",
      direction: "out",
      amountPaise: 100000,
    });
    const onOpening = mkTxn({
      accountId: bank._id,
      valueDate: "2026-04-01",
      flowType: "spend",
      direction: "out",
      amountPaise: 50000,
    });
    const bal = accountBalanceAt(bank._id, {
      transactions: [preOpening, onOpening],
      accounts: [bank],
    });
    expect(bal.ownerPerspectivePaise).toBe(5000000 - 50000);

    const onlyAtOpening = accountBalanceAt(bank._id, {
      transactions: [preOpening],
      accounts: [bank],
      cutoff: "2026-04-01",
    });
    expect(onlyAtOpening.ownerPerspectivePaise).toBe(5000000);
  });
});

describe("Cross-cutting — property: paired legs sum to zero", () => {
  it("every transfer & card_settlement pair sums to zero across both legs", () => {
    const bank = mkAccount({ _id: "bP", openingBalancePaise: 0 });
    const cash = mkAccount({ _id: "cP", openingBalancePaise: 0 });
    const card = mkAccount({ _id: "kP", classification: "liability", openingBalancePaise: 0 });
    const pairs: Array<{ a: TxnLite; b: TxnLite; accA: AccountLite; accB: AccountLite }> = [
      {
        accA: bank,
        accB: cash,
        a: mkTxn({
          accountId: bank._id,
          flowType: "transfer",
          direction: "out",
          amountPaise: 12345,
        }),
        b: mkTxn({
          accountId: cash._id,
          flowType: "transfer",
          direction: "in",
          amountPaise: 12345,
        }),
      },
      {
        accA: bank,
        accB: card,
        a: mkTxn({
          accountId: bank._id,
          flowType: "card_settlement",
          direction: "out",
          amountPaise: 250000,
        }),
        b: mkTxn({
          accountId: card._id,
          flowType: "card_settlement",
          direction: "in",
          amountPaise: 250000,
        }),
      },
    ];
    for (const p of pairs) {
      const input = { transactions: [p.a, p.b], accounts: [p.accA, p.accB] };
      const balances = allAccountBalances(input);
      const sum = balances.reduce((acc, b) => acc + b.ownerPerspectivePaise, 0);
      expect(sum).toBe(0);
    }
  });
});

describe("spendTotal — fees and includeFees toggle", () => {
  it("includes fees by default; can exclude", () => {
    const bank = mkAccount({ openingBalancePaise: 0 });
    const txns: TxnLite[] = [
      mkTxn({
        accountId: bank._id,
        flowType: "spend",
        direction: "out",
        amountPaise: 100000,
      }),
      mkTxn({
        accountId: bank._id,
        flowType: "fee",
        direction: "out",
        amountPaise: 5000,
      }),
    ];
    const input = { transactions: txns, accounts: [bank] };
    expect(spendTotal(input).paise).toBe(105000);
    expect(spendTotal(input, { includeFees: false }).paise).toBe(100000);
  });
});

describe("P5 — SplitBill source txn reports ownShare as spend, remainder as lending_out", () => {
  it("₹1,200 spend split 4 ways (owner ₹300): spendTotal=300, lending_out=900, balance still -1,200", () => {
    const bank = mkAccount({ openingBalancePaise: 1000000 });
    const split = mkTxn({
      accountId: bank._id,
      flowType: "spend",
      direction: "out",
      amountPaise: 120000,
      splitId: "sb1",
      splitOwnSharePaise: 30000,
    });
    const input = { transactions: [split], accounts: [bank] };
    expect(accountBalanceAt(bank._id, input).ownerPerspectivePaise).toBe(1000000 - 120000);
    expect(spendTotal(input).paise).toBe(30000);
    const totals = flowTotals(input);
    expect(totals.spend.paise).toBe(30000);
    expect(totals.lending_out.paise).toBe(90000);
  });

  it("falls back to full amount if splitOwnSharePaise is absent", () => {
    const bank = mkAccount({ openingBalancePaise: 0 });
    const t = mkTxn({
      accountId: bank._id,
      flowType: "spend",
      direction: "out",
      amountPaise: 100000,
    });
    const input = { transactions: [t], accounts: [bank] };
    expect(spendTotal(input).paise).toBe(100000);
    expect(flowTotals(input).lending_out.paise).toBe(0);
  });

  it("clamps splitOwnSharePaise into [0, amountPaise] defensively", () => {
    const bank = mkAccount({ openingBalancePaise: 0 });
    const negative = mkTxn({
      accountId: bank._id,
      _id: "neg",
      flowType: "spend",
      direction: "out",
      amountPaise: 100000,
      splitOwnSharePaise: -5,
    });
    const overshoot = mkTxn({
      accountId: bank._id,
      _id: "over",
      flowType: "spend",
      direction: "out",
      amountPaise: 100000,
      splitOwnSharePaise: 999999,
    });
    const a = { transactions: [negative], accounts: [bank] };
    const b = { transactions: [overshoot], accounts: [bank] };
    expect(spendTotal(a).paise).toBe(0);
    expect(flowTotals(a).lending_out.paise).toBe(100000);
    expect(spendTotal(b).paise).toBe(100000);
    expect(flowTotals(b).lending_out.paise).toBe(0);
  });

  it("does not affect non-spend flowTypes even when splitOwnSharePaise is set", () => {
    const bank = mkAccount({ openingBalancePaise: 0 });
    const t = mkTxn({
      accountId: bank._id,
      flowType: "transfer",
      direction: "out",
      amountPaise: 100000,
      splitOwnSharePaise: 10000,
    });
    const input = { transactions: [t], accounts: [bank] };
    expect(flowTotals(input).transfer.paise).toBe(100000);
    expect(flowTotals(input).lending_out.paise).toBe(0);
  });
});

describe("accountTimeSeries — running balance over time", () => {
  it("produces a sorted running balance, bucketed by day", () => {
    const bank = mkAccount({ openingBalancePaise: 0 });
    const t1 = mkTxn({
      accountId: bank._id,
      valueDate: "2026-05-01",
      direction: "in",
      flowType: "income",
      amountPaise: 100000,
    });
    const t2 = mkTxn({
      accountId: bank._id,
      valueDate: "2026-05-15",
      direction: "out",
      flowType: "spend",
      amountPaise: 30000,
    });
    const series = accountTimeSeries(
      bank._id,
      { transactions: [t2, t1], accounts: [bank] },
      "day",
    );
    expect(series).toEqual([
      { date: "2026-05-01", paise: 100000 },
      { date: "2026-05-15", paise: 70000 },
    ]);
  });

  it("buckets monthly when granularity = month", () => {
    const bank = mkAccount({ openingBalancePaise: 0 });
    const txns: TxnLite[] = [
      mkTxn({
        accountId: bank._id,
        valueDate: "2026-05-01",
        direction: "in",
        flowType: "income",
        amountPaise: 100000,
      }),
      mkTxn({
        accountId: bank._id,
        valueDate: "2026-05-15",
        direction: "out",
        flowType: "spend",
        amountPaise: 30000,
      }),
      mkTxn({
        accountId: bank._id,
        valueDate: "2026-06-05",
        direction: "in",
        flowType: "income",
        amountPaise: 50000,
      }),
    ];
    const series = accountTimeSeries(
      bank._id,
      { transactions: txns, accounts: [bank] },
      "month",
    );
    expect(series).toEqual([
      { date: "2026-05", paise: 70000 },
      { date: "2026-06", paise: 120000 },
    ]);
  });
});

describe("accountBalanceAt — unknown account", () => {
  it("throws", () => {
    const bank = mkAccount({ _id: "real" });
    expect(() =>
      accountBalanceAt("missing", { transactions: [], accounts: [bank] }),
    ).toThrow();
  });
});
