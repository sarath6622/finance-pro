import { describe, expect, it } from "vitest";
import { applyBuy } from "./apply-buy";
import { applySell, SellOverflowError } from "./apply-sell";
import type { HoldingLite } from "./types";

function freshHolding(overrides: Partial<HoldingLite> = {}): HoldingLite {
  return {
    _id: "h1",
    assetType: "crypto",
    symbol: "BTC",
    name: "Bitcoin",
    platform: "CoinDCX",
    quantity: 0,
    lots: [],
    priceCurrency: "INR",
    priceSource: "manual",
    realizedPnLPaise: 0,
    isActive: true,
    ...overrides,
  };
}

describe("applyBuy", () => {
  it("appends a lot and updates quantity", () => {
    const h = freshHolding();
    const r = applyBuy(h, {
      date: "2026-01-01",
      quantity: 0.5,
      unitCostPaise: 500_000_000, // ₹50L
    });
    expect(r.quantity).toBe(0.5);
    expect(r.lots).toHaveLength(1);
    expect(r.lots[0]!.unitCostPaise).toBe(500_000_000);
  });

  it("keeps lots sorted by date (insertion-stable on ties)", () => {
    let h = freshHolding();
    h = applyBuy(h, { date: "2026-03-01", quantity: 1, unitCostPaise: 30000 });
    h = applyBuy(h, { date: "2026-01-01", quantity: 2, unitCostPaise: 10000 });
    h = applyBuy(h, { date: "2026-03-01", quantity: 0.5, unitCostPaise: 31000 });
    expect(h.quantity).toBe(3.5);
    expect(h.lots.map((l) => l.date)).toEqual(["2026-01-01", "2026-03-01", "2026-03-01"]);
    expect(h.lots[1]!.unitCostPaise).toBe(30000); // first 2026-03-01 still before the second one
    expect(h.lots[2]!.unitCostPaise).toBe(31000);
  });

  it("rejects zero / negative qty", () => {
    expect(() =>
      applyBuy(freshHolding(), { date: "2026-01-01", quantity: 0, unitCostPaise: 100 }),
    ).toThrow();
  });

  it("rejects non-integer paise", () => {
    expect(() =>
      applyBuy(freshHolding(), { date: "2026-01-01", quantity: 1, unitCostPaise: 100.5 }),
    ).toThrow(/integer/);
  });
});

describe("applySell — PRD acceptance: 0.2 BTC of 0.5 BTC at ₹60L (bought ₹50L) → realizedPnL ₹2L exact", () => {
  it("matches the acceptance criterion paise-precise", () => {
    let h = freshHolding();
    h = applyBuy(h, {
      date: "2026-01-01",
      quantity: 0.5,
      unitCostPaise: 500_000_000, // ₹50L per BTC
    });
    const r = applySell(h, {
      date: "2026-06-01",
      quantity: 0.2,
      unitPricePaise: 600_000_000, // ₹60L per BTC
    });
    expect(r.realizedPnLPaise).toBe(20_000_000); // ₹2L
    expect(r.totalProceedsPaise).toBe(120_000_000); // ₹12L
    expect(r.holding.quantity).toBe(0.3);
    expect(r.holding.realizedPnLPaise).toBe(20_000_000);
    expect(r.holding.lots[0]!.quantity).toBe(0.3); // partial lot remainder (E34)
  });
});

describe("applySell — FIFO across multiple lots", () => {
  it("consumes earliest lots first, then partial-consumes the next", () => {
    let h = freshHolding();
    h = applyBuy(h, { date: "2026-01-01", quantity: 1, unitCostPaise: 10000 }); // ₹100/unit
    h = applyBuy(h, { date: "2026-02-01", quantity: 2, unitCostPaise: 20000 }); // ₹200/unit
    h = applyBuy(h, { date: "2026-03-01", quantity: 1, unitCostPaise: 30000 }); // ₹300/unit
    // Sell 2.5 at ₹400/unit
    const r = applySell(h, { date: "2026-04-01", quantity: 2.5, unitPricePaise: 40000 });
    // Consumes: lot1 (1 @ ₹100) + lot2 (1.5 of 2 @ ₹200)
    // Proceeds: 1×400 + 1.5×400 = 1_000 paise = ₹10
    expect(r.totalProceedsPaise).toBe(100000);
    // Cost: 1×100 + 1.5×200 = 400 paise
    // Wait — lot1 was 1×10000 paise = 10000 paise (₹100). Recompute:
    // Lot1: 1 unit × 10000 paise = 10000 paise
    // Lot2 (partial): 1.5 units × 20000 paise = 30000 paise
    // Cost basis = 40000 paise
    // Proceeds: 2.5 × 40000 paise = 100000 paise
    // P&L = 100000 - 40000 = 60000 paise
    expect(r.realizedPnLPaise).toBe(60000);
    expect(r.consumed).toHaveLength(2);
    expect(r.consumed[0]!.qtyConsumed).toBe(1);
    expect(r.consumed[1]!.qtyConsumed).toBe(1.5);
    // Remaining: lot2 leftover 0.5, lot3 intact 1
    expect(r.holding.lots).toHaveLength(2);
    expect(r.holding.lots[0]!.quantity).toBe(0.5);
    expect(r.holding.lots[0]!.unitCostPaise).toBe(20000);
    expect(r.holding.lots[1]!.quantity).toBe(1);
    expect(r.holding.quantity).toBe(1.5);
  });

  it("8dp crypto: partial lot consumption preserves precision", () => {
    let h = freshHolding();
    h = applyBuy(h, { date: "2026-01-01", quantity: 0.12345678, unitCostPaise: 1_000_000 });
    const r = applySell(h, {
      date: "2026-06-01",
      quantity: 0.05000000,
      unitPricePaise: 2_000_000,
    });
    expect(r.holding.quantity).toBe(0.07345678);
    expect(r.realizedPnLPaise).toBeGreaterThan(0);
  });

  it("realized loss (sell below cost) returns negative P&L", () => {
    let h = freshHolding();
    h = applyBuy(h, { date: "2026-01-01", quantity: 1, unitCostPaise: 20000 });
    const r = applySell(h, { date: "2026-06-01", quantity: 1, unitPricePaise: 15000 });
    expect(r.realizedPnLPaise).toBe(-5000);
    expect(r.holding.realizedPnLPaise).toBe(-5000);
  });

  it("over-selling throws SellOverflowError", () => {
    let h = freshHolding();
    h = applyBuy(h, { date: "2026-01-01", quantity: 1, unitCostPaise: 20000 });
    expect(() => applySell(h, { date: "2026-06-01", quantity: 2, unitPricePaise: 30000 })).toThrow(
      SellOverflowError,
    );
  });

  it("selling exact total empties the holding", () => {
    let h = freshHolding();
    h = applyBuy(h, { date: "2026-01-01", quantity: 1, unitCostPaise: 20000 });
    const r = applySell(h, { date: "2026-06-01", quantity: 1, unitPricePaise: 25000 });
    expect(r.holding.quantity).toBe(0);
    expect(r.holding.lots).toHaveLength(0);
  });
});
