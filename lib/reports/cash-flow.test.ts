import { describe, expect, it } from "vitest";
import { cashFlow } from "./cash-flow";
import { buildPeriod } from "./period";
import type { TxnLite } from "@/lib/balances/types";
import { mkTxn } from "@/lib/test-utils/fixtures";

const MAY = buildPeriod({ mode: "calendar", anchorDay: 5, year: 2026, month: 5 });

describe("cashFlow (R8)", () => {
  it("separates inflow vs outflow per flow type with net", () => {
    const txns: TxnLite[] = [
      mkTxn({
        accountId: "a",
        flowType: "income",
        direction: "in",
        amountPaise: 10000000,
        valueDate: "2026-05-05",
      }),
      mkTxn({
        accountId: "a",
        flowType: "spend",
        direction: "out",
        amountPaise: 200000,
        valueDate: "2026-05-10",
      }),
      mkTxn({
        accountId: "a",
        flowType: "fee",
        direction: "out",
        amountPaise: 5000,
        valueDate: "2026-05-11",
      }),
    ];
    const r = cashFlow({ transactions: txns, period: MAY });
    expect(r.perFlowType.income.inflowPaise).toBe(10000000);
    expect(r.perFlowType.spend.outflowPaise).toBe(200000);
    expect(r.perFlowType.fee.outflowPaise).toBe(5000);
    expect(r.trueInflowPaise).toBe(10000000);
    expect(r.trueOutflowPaise).toBe(205000);
    expect(r.netCashFlowPaise).toBe(9795000);
  });

  it("transfer and card_settlement do not contribute to true cash flow", () => {
    const txns: TxnLite[] = [
      mkTxn({
        accountId: "a",
        flowType: "transfer",
        direction: "out",
        amountPaise: 100000,
        valueDate: "2026-05-15",
      }),
      mkTxn({
        accountId: "a",
        flowType: "card_settlement",
        direction: "out",
        amountPaise: 50000,
        valueDate: "2026-05-15",
      }),
      mkTxn({
        accountId: "a",
        flowType: "income",
        direction: "in",
        amountPaise: 10000,
        valueDate: "2026-05-05",
      }),
    ];
    const r = cashFlow({ transactions: txns, period: MAY });
    expect(r.totalOutflowPaise).toBe(150000);
    expect(r.trueOutflowPaise).toBe(0);
    expect(r.trueInflowPaise).toBe(10000);
    expect(r.netCashFlowPaise).toBe(10000);
  });

  it("SplitBill source spend reattributes others-share to lending_out (matches monthOverview)", () => {
    const split: TxnLite = {
      ...mkTxn({
        accountId: "a",
        flowType: "spend",
        direction: "out",
        amountPaise: 120000,
        valueDate: "2026-05-15",
      }),
      splitId: "sb1",
      splitOwnSharePaise: 30000,
    };
    const r = cashFlow({ transactions: [split], period: MAY });
    expect(r.perFlowType.spend.outflowPaise).toBe(30000);
    expect(r.perFlowType.lending_out.outflowPaise).toBe(90000);
    expect(r.totalOutflowPaise).toBe(120000);
  });

  it("excludes soft-deleted and split-parent containers", () => {
    const parent = mkTxn({
      accountId: "a",
      _id: "p",
      amountPaise: 1000,
      flowType: "spend",
      direction: "out",
      valueDate: "2026-05-15",
    });
    const child = mkTxn({
      accountId: "a",
      parentTransactionId: "p",
      amountPaise: 1000,
      flowType: "fee",
      direction: "out",
      valueDate: "2026-05-15",
    });
    const deleted = mkTxn({
      accountId: "a",
      flowType: "spend",
      direction: "out",
      amountPaise: 9999,
      valueDate: "2026-05-15",
      isDeleted: true,
    });
    const r = cashFlow({ transactions: [parent, child, deleted], period: MAY });
    expect(r.perFlowType.spend.outflowPaise).toBe(0);
    expect(r.perFlowType.fee.outflowPaise).toBe(1000);
  });
});
