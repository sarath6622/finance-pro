import { describe, it, expect } from "vitest";
import {
  splitInput,
  transactionCreateInput,
  transactionPatchInput,
  transferInput,
} from "./validate";

const validOid = "0".repeat(23) + "1";

describe("transactionCreateInput", () => {
  const base = {
    valueDate: "2026-05-30",
    amountPaise: 10000,
    direction: "out",
    flowType: "spend",
    accountId: validOid,
  };

  it("accepts a valid spend", () => {
    expect(() => transactionCreateInput.parse(base)).not.toThrow();
  });

  it("rejects flowType 'transfer' on the generic endpoint", () => {
    expect(() => transactionCreateInput.parse({ ...base, flowType: "transfer" })).toThrow();
  });

  it("rejects direction that contradicts flowType", () => {
    expect(() =>
      transactionCreateInput.parse({ ...base, flowType: "income", direction: "out" }),
    ).toThrow();
    expect(() =>
      transactionCreateInput.parse({ ...base, flowType: "spend", direction: "in" }),
    ).toThrow();
  });

  it("allows either direction for card_settlement", () => {
    expect(() =>
      transactionCreateInput.parse({ ...base, flowType: "card_settlement", direction: "in" }),
    ).not.toThrow();
    expect(() =>
      transactionCreateInput.parse({ ...base, flowType: "card_settlement", direction: "out" }),
    ).not.toThrow();
  });

  it("requires amountPaise > 0", () => {
    expect(() => transactionCreateInput.parse({ ...base, amountPaise: 0 })).toThrow();
    expect(() => transactionCreateInput.parse({ ...base, amountPaise: -5 })).toThrow();
  });

  it("accepts needWant on spend (optional)", () => {
    expect(() =>
      transactionCreateInput.parse({ ...base, needWant: "want" }),
    ).not.toThrow();
    expect(() => transactionCreateInput.parse(base)).not.toThrow();
  });
});

describe("transactionPatchInput", () => {
  it("requires at least one field", () => {
    expect(() => transactionPatchInput.parse({})).toThrow();
  });

  it("rejects direction/flowType combos that contradict", () => {
    expect(() =>
      transactionPatchInput.parse({ flowType: "income", direction: "out" }),
    ).toThrow();
  });

  it("allows direction OR flowType alone without forcing coherence on the other", () => {
    expect(() => transactionPatchInput.parse({ direction: "in" })).not.toThrow();
    expect(() => transactionPatchInput.parse({ flowType: "income" })).not.toThrow();
  });
});

describe("splitInput", () => {
  it("requires at least 2 children", () => {
    expect(() =>
      splitInput.parse({ children: [{ amountPaise: 100, flowType: "spend" }] }),
    ).toThrow();
  });

  it("rejects transfer/card_settlement children", () => {
    expect(() =>
      splitInput.parse({
        children: [
          { amountPaise: 100, flowType: "spend" },
          { amountPaise: 100, flowType: "transfer" },
        ],
      }),
    ).toThrow();
  });
});

describe("transferInput", () => {
  const base = {
    fromAccountId: validOid,
    toAccountId: "0".repeat(23) + "2",
    amountPaise: 100000,
    valueDate: "2026-05-30",
  };

  it("rejects same-account transfer", () => {
    expect(() => transferInput.parse({ ...base, toAccountId: base.fromAccountId })).toThrow();
  });

  it("accepts a valid transfer", () => {
    expect(() => transferInput.parse(base)).not.toThrow();
  });
});
