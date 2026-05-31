import { describe, expect, it } from "vitest";
import { applyBuy } from "./apply-buy";
import {
  applyCorporateAction,
  CorporateActionError,
} from "./apply-corporate-action";
import type { HoldingLite } from "./types";

function fresh(): HoldingLite {
  return {
    _id: "h1",
    assetType: "stock",
    symbol: "TCS",
    name: "TCS Ltd",
    platform: "Zerodha",
    quantity: 0,
    lots: [],
    priceCurrency: "INR",
    priceSource: "manual",
    realizedPnLPaise: 0,
    isActive: true,
  };
}

describe("applyCorporateAction — PRD acceptance: 1:2 split on 100-qty halves cost, doubles qty, no P&L", () => {
  it("matches the acceptance criterion exactly", () => {
    let h = fresh();
    h = applyBuy(h, { date: "2026-01-01", quantity: 100, unitCostPaise: 200000 }); // ₹2000/share
    const totalBefore = h.lots[0]!.quantity * h.lots[0]!.unitCostPaise;
    const r = applyCorporateAction(h, { kind: "split", ratioNumerator: 2, ratioDenominator: 1 });
    expect(r.quantity).toBe(200);
    expect(r.lots[0]!.quantity).toBe(200);
    expect(r.lots[0]!.unitCostPaise).toBe(100000); // halved
    const totalAfter = r.lots[0]!.quantity * r.lots[0]!.unitCostPaise;
    expect(totalAfter).toBe(totalBefore); // basis conserved
    expect(r.realizedPnLPaise).toBe(0); // no P&L event
  });

  it("3:2 split with mixed lots conserves total cost basis", () => {
    let h = fresh();
    h = applyBuy(h, { date: "2026-01-01", quantity: 50, unitCostPaise: 300000 });
    h = applyBuy(h, { date: "2026-03-01", quantity: 50, unitCostPaise: 400000 });
    const totalBefore =
      h.lots[0]!.quantity * h.lots[0]!.unitCostPaise +
      h.lots[1]!.quantity * h.lots[1]!.unitCostPaise;
    const r = applyCorporateAction(h, {
      kind: "split",
      ratioNumerator: 3,
      ratioDenominator: 2,
    });
    expect(r.quantity).toBe(150);
    expect(r.lots[0]!.quantity).toBe(75);
    expect(r.lots[1]!.quantity).toBe(75);
    expect(r.lots[0]!.unitCostPaise).toBe(200000);
    expect(r.lots[1]!.unitCostPaise).toBe(266667); // 400000 × 2/3 ≈ 266666.7
    const totalAfter =
      r.lots[0]!.quantity * r.lots[0]!.unitCostPaise +
      r.lots[1]!.quantity * r.lots[1]!.unitCostPaise;
    // Allow ±100 paise rounding drift across lots
    expect(Math.abs(totalAfter - totalBefore)).toBeLessThanOrEqual(100);
  });

  it("no-op ratio 1:1 returns the holding unchanged", () => {
    let h = fresh();
    h = applyBuy(h, { date: "2026-01-01", quantity: 100, unitCostPaise: 200000 });
    const r = applyCorporateAction(h, { kind: "split", ratioNumerator: 1, ratioDenominator: 1 });
    expect(r.quantity).toBe(100);
    expect(r.lots[0]!.unitCostPaise).toBe(200000);
  });

  it("invalid ratios throw", () => {
    expect(() =>
      applyCorporateAction(fresh(), { kind: "split", ratioNumerator: 0, ratioDenominator: 1 }),
    ).toThrow(CorporateActionError);
    expect(() =>
      applyCorporateAction(fresh(), { kind: "split", ratioNumerator: 2, ratioDenominator: 0 }),
    ).toThrow(CorporateActionError);
  });
});
