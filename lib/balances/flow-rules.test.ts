import { describe, it, expect } from "vitest";
import {
  SPEND_FLOW_TYPES,
  PASS_THROUGH_FLOW_TYPES,
  flowAffectsSpending,
  flowAffectsNetWorth,
  expectedDirection,
  signedDelta,
} from "./flow-rules";
import type { FlowType } from "@/lib/schemas/common";
import { mkAccount, mkTxn } from "@/lib/test-utils/fixtures";

describe("flow-rules — spending vs pass-through partition (CLAUDE.md invariant #3)", () => {
  it("only spend and fee count toward spending", () => {
    expect(SPEND_FLOW_TYPES.has("spend")).toBe(true);
    expect(SPEND_FLOW_TYPES.has("fee")).toBe(true);
    expect(SPEND_FLOW_TYPES.size).toBe(2);
  });

  it("pass-through types are mutually exclusive with spend", () => {
    for (const ft of PASS_THROUGH_FLOW_TYPES) {
      expect(SPEND_FLOW_TYPES.has(ft)).toBe(false);
    }
  });

  it("flowAffectsSpending matches the spend set", () => {
    expect(flowAffectsSpending("spend")).toBe(true);
    expect(flowAffectsSpending("fee")).toBe(true);
    expect(flowAffectsSpending("card_settlement")).toBe(false);
    expect(flowAffectsSpending("transfer")).toBe(false);
    expect(flowAffectsSpending("lending_out")).toBe(false);
    expect(flowAffectsSpending("reimbursement_in")).toBe(false);
    expect(flowAffectsSpending("investment")).toBe(false);
    expect(flowAffectsSpending("family_support")).toBe(false);
    expect(flowAffectsSpending("debt_repayment")).toBe(false);
    expect(flowAffectsSpending("income")).toBe(false);
  });

  it("flowAffectsNetWorth marks spend/income/fee only", () => {
    expect(flowAffectsNetWorth("spend")).toBe(true);
    expect(flowAffectsNetWorth("income")).toBe(true);
    expect(flowAffectsNetWorth("fee")).toBe(true);
    expect(flowAffectsNetWorth("transfer")).toBe(false);
    expect(flowAffectsNetWorth("card_settlement")).toBe(false);
  });

  it("expectedDirection covers every flow type", () => {
    const all: FlowType[] = [
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
    for (const ft of all) {
      const d = expectedDirection(ft);
      expect(["in", "out", "either"]).toContain(d);
    }
    expect(expectedDirection("income")).toBe("in");
    expect(expectedDirection("lending_repaid")).toBe("in");
    expect(expectedDirection("reimbursement_in")).toBe("in");
    expect(expectedDirection("spend")).toBe("out");
    expect(expectedDirection("transfer")).toBe("either");
    expect(expectedDirection("card_settlement")).toBe("either");
  });
});

describe("signedDelta — single formula across asset and liability accounts (E4)", () => {
  it("asset out is negative; in is positive", () => {
    const bank = mkAccount({ classification: "asset", openingBalancePaise: 0 });
    const out = mkTxn({ accountId: bank._id, direction: "out", amountPaise: 50000 });
    const inn = mkTxn({ accountId: bank._id, direction: "in", amountPaise: 50000 });
    expect(signedDelta(out, bank).paise).toBe(-50000);
    expect(signedDelta(inn, bank).paise).toBe(50000);
  });

  it("liability out makes the (signed-negative) balance more negative (E4 charge)", () => {
    const card = mkAccount({ classification: "liability", openingBalancePaise: -2500000 });
    const charge = mkTxn({
      accountId: card._id,
      flowType: "spend",
      direction: "out",
      amountPaise: 50000,
    });
    expect(signedDelta(charge, card).paise).toBe(-50000);
  });

  it("liability in shrinks the liability toward zero (E4 settlement)", () => {
    const card = mkAccount({ classification: "liability", openingBalancePaise: -2500000 });
    const settle = mkTxn({
      accountId: card._id,
      flowType: "card_settlement",
      direction: "in",
      amountPaise: 2500000,
    });
    expect(signedDelta(settle, card).paise).toBe(2500000);
  });
});

describe("signedDelta — two-leg balance preservation (FR-9, E18, E4)", () => {
  it("transfer between two asset accounts sums to zero across the two legs", () => {
    const bank = mkAccount({ classification: "asset", _id: "a-bank" });
    const cash = mkAccount({ classification: "asset", _id: "a-cash" });
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
    const net = signedDelta(legOut, bank).paise + signedDelta(legIn, cash).paise;
    expect(net).toBe(0);
  });

  it("card_settlement between asset bank and liability card sums to zero", () => {
    const bank = mkAccount({ classification: "asset", _id: "a-bank2" });
    const card = mkAccount({ classification: "liability", _id: "a-card" });
    const legBank = mkTxn({
      accountId: bank._id,
      flowType: "card_settlement",
      direction: "out",
      amountPaise: 1000000,
    });
    const legCard = mkTxn({
      accountId: card._id,
      flowType: "card_settlement",
      direction: "in",
      amountPaise: 1000000,
    });
    const net = signedDelta(legBank, bank).paise + signedDelta(legCard, card).paise;
    expect(net).toBe(0);
  });
});
