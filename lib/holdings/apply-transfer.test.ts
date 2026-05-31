import { describe, expect, it } from "vitest";
import { applyBuy } from "./apply-buy";
import {
  applyTransfer,
  mergeTransferredLots,
  TransferError,
} from "./apply-transfer";
import type { HoldingLite } from "./types";

function fresh(platform = "CoinDCX"): HoldingLite {
  return {
    _id: "src",
    assetType: "crypto",
    symbol: "BTC",
    name: "Bitcoin",
    platform,
    quantity: 0,
    lots: [],
    priceCurrency: "INR",
    priceSource: "manual",
    realizedPnLPaise: 0,
    isActive: true,
  };
}

describe("applyTransfer — PRD acceptance: crypto CoinDCX → wallet preserves cost basis, no P&L (E35)", () => {
  it("carves FIFO from source, no realized P&L", () => {
    let h = fresh("CoinDCX");
    h = applyBuy(h, { date: "2026-01-01", quantity: 0.5, unitCostPaise: 500_000_000 });
    h = applyBuy(h, { date: "2026-03-01", quantity: 0.3, unitCostPaise: 700_000_000 });
    const r = applyTransfer(h, { date: "2026-04-01", quantity: 0.6, toPlatform: "Wallet" });
    expect(r.from.quantity).toBe(0.2);
    expect(r.from.lots).toHaveLength(1);
    expect(r.from.lots[0]!.date).toBe("2026-03-01");
    expect(r.from.lots[0]!.quantity).toBe(0.2);
    expect(r.from.lots[0]!.unitCostPaise).toBe(700_000_000);
    expect(r.from.realizedPnLPaise).toBe(0); // no P&L
    expect(r.movedQuantity).toBe(0.6);
    expect(r.movedLots).toHaveLength(2);
    expect(r.movedLots[0]!.quantity).toBe(0.5);
    expect(r.movedLots[0]!.unitCostPaise).toBe(500_000_000);
    expect(r.movedLots[1]!.quantity).toBeCloseTo(0.1, 8);
    expect(r.movedLots[1]!.unitCostPaise).toBe(700_000_000);
  });

  it("rejects transfer to same platform", () => {
    let h = fresh("CoinDCX");
    h = applyBuy(h, { date: "2026-01-01", quantity: 1, unitCostPaise: 100 });
    expect(() =>
      applyTransfer(h, { date: "2026-04-01", quantity: 0.5, toPlatform: "CoinDCX" }),
    ).toThrow(TransferError);
  });

  it("rejects insufficient quantity", () => {
    let h = fresh("CoinDCX");
    h = applyBuy(h, { date: "2026-01-01", quantity: 0.5, unitCostPaise: 100 });
    expect(() =>
      applyTransfer(h, { date: "2026-04-01", quantity: 1, toPlatform: "Wallet" }),
    ).toThrow(TransferError);
  });
});

describe("mergeTransferredLots — same asset on multi platforms (E37)", () => {
  it("merges into destination holding sorted by date", () => {
    let dest = fresh("Wallet");
    dest = applyBuy(dest, { date: "2026-02-01", quantity: 0.1, unitCostPaise: 600_000_000 });
    const movedLots = [
      { date: "2026-01-01", quantity: 0.5, unitCostPaise: 500_000_000 },
      { date: "2026-03-01", quantity: 0.1, unitCostPaise: 700_000_000 },
    ];
    const merged = mergeTransferredLots(dest, movedLots, 0.6);
    expect(merged.quantity).toBeCloseTo(0.7, 8);
    expect(merged.lots).toHaveLength(3);
    expect(merged.lots.map((l) => l.date)).toEqual(["2026-01-01", "2026-02-01", "2026-03-01"]);
  });
});
