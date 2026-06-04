import { describe, it, expect } from "vitest";
import {
  applyEditHistory,
  buildCardSettlementLegs,
  buildSplitChildren,
  buildTransferLegs,
  markSoftDeleted,
  type ParentLike,
} from "./mutations";

const NOW = "2026-05-30T15:00:00.000Z";

describe("applyEditHistory", () => {
  it("records changed fields with at/field/from/to", () => {
    const prev = { amountPaise: 1000, description: "tea" };
    const { next, entries } = applyEditHistory(
      prev,
      { amountPaise: 2000, description: "coffee" },
      NOW,
    );
    expect(next).toEqual({ amountPaise: 2000, description: "coffee" });
    expect(entries.length).toBe(2);
    expect(entries.find((e) => e.field === "amountPaise")).toEqual({
      at: NOW,
      field: "amountPaise",
      from: 1000,
      to: 2000,
    });
  });

  it("skips unchanged fields", () => {
    const prev = { amountPaise: 1000, description: "tea" };
    const { entries } = applyEditHistory(
      prev,
      { amountPaise: 1000, description: "coffee" },
      NOW,
    );
    expect(entries.length).toBe(1);
    expect(entries[0]!.field).toBe("description");
  });

  it("ignores undefined patch values", () => {
    const prev = { a: 1, b: 2 };
    const { entries, next } = applyEditHistory(prev, { a: undefined, b: 3 }, NOW);
    expect(next).toEqual({ a: 1, b: 3 });
    expect(entries.length).toBe(1);
  });
});

describe("markSoftDeleted", () => {
  it("sets isDeleted and deletedAt and records the change", () => {
    const prev = { isDeleted: false, amountPaise: 1000 };
    const { next, entries } = markSoftDeleted(prev, NOW);
    expect(next.isDeleted).toBe(true);
    expect(entries.find((e) => e.field === "isDeleted")).toBeTruthy();
  });
});

describe("buildSplitChildren", () => {
  const parent: ParentLike = {
    _id: "p1",
    amountPaise: 6000000,
    direction: "out",
    accountId: "a1",
    valueDate: "2026-05-30",
    bookedAt: NOW,
    isDeleted: false,
  };

  it("requires children to sum to parent exactly", () => {
    const r = buildSplitChildren(
      parent,
      [
        { amountPaise: 2500000, flowType: "family_support" },
        { amountPaise: 2500000, flowType: "family_support" },
        { amountPaise: 999999, flowType: "debt_repayment" },
      ],
      false,
      NOW,
    );
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.errors.some((e) => /sum/.test(e))).toBe(true);
  });

  it("emits children with inherited account, direction, valueDate; source=split_child", () => {
    const r = buildSplitChildren(
      parent,
      [
        { amountPaise: 2500000, flowType: "family_support" },
        { amountPaise: 2500000, flowType: "family_support" },
        { amountPaise: 1000000, flowType: "debt_repayment" },
      ],
      false,
      NOW,
    );
    expect(r.errors).toEqual([]);
    expect(r.children.length).toBe(3);
    for (const c of r.children) {
      expect(c.parentTransactionId).toBe("p1");
      expect(c.accountId).toBe("a1");
      expect(c.direction).toBe("out");
      expect(c.source).toBe("split_child");
      expect(c.valueDate).toBe("2026-05-30");
    }
    const sum = r.children.reduce((s, c) => s + c.amountPaise, 0);
    expect(sum).toBe(parent.amountPaise);
  });

  it("rejects re-split (parent already has live children)", () => {
    const r = buildSplitChildren(
      parent,
      [
        { amountPaise: 1000, flowType: "spend" },
        { amountPaise: 5999000, flowType: "spend" },
      ],
      true,
      NOW,
    );
    expect(r.errors.some((e) => /already has live children/.test(e))).toBe(true);
  });

  it("rejects split when parent is linked to a receivable or split", () => {
    const linked = { ...parent, receivableId: "r1" };
    const r1 = buildSplitChildren(linked, [], false, NOW);
    expect(r1.errors.some((e) => /receivable/.test(e))).toBe(true);
    const linked2 = { ...parent, splitId: "s1" };
    const r2 = buildSplitChildren(linked2, [], false, NOW);
    expect(r2.errors.some((e) => /SplitBill/.test(e))).toBe(true);
  });
});

describe("buildTransferLegs", () => {
  it("creates two legs with opposite directions and equal amounts", () => {
    const { legA, legB } = buildTransferLegs(
      {
        fromAccountId: "a-from",
        toAccountId: "a-to",
        amountPaise: 500000,
        valueDate: "2026-05-30",
      },
      NOW,
    );
    expect(legA.accountId).toBe("a-from");
    expect(legA.direction).toBe("out");
    expect(legA.flowType).toBe("transfer");
    expect(legB.accountId).toBe("a-to");
    expect(legB.direction).toBe("in");
    expect(legB.flowType).toBe("transfer");
    expect(legA.amountPaise).toBe(legB.amountPaise);
    expect(legA.valueDate).toBe(legB.valueDate);
  });
});

describe("buildCardSettlementLegs", () => {
  it("debits the bank and credits the card with flowType card_settlement", () => {
    const { legBank, legCard } = buildCardSettlementLegs(
      {
        fromAccountId: "bank-1",
        toCardAccountId: "card-1",
        amountPaise: 1_234_400,
        valueDate: "2026-06-04",
      },
      NOW,
    );
    expect(legBank.accountId).toBe("bank-1");
    expect(legBank.direction).toBe("out");
    expect(legBank.flowType).toBe("card_settlement");
    expect(legCard.accountId).toBe("card-1");
    expect(legCard.direction).toBe("in");
    expect(legCard.flowType).toBe("card_settlement");
    expect(legBank.amountPaise).toBe(legCard.amountPaise);
    expect(legBank.valueDate).toBe(legCard.valueDate);
    expect(legBank.bookedAt).toBe(NOW);
    expect(legCard.bookedAt).toBe(NOW);
  });
});
