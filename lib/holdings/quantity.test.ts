import { describe, expect, it } from "vitest";
import {
  fromMicroUnits,
  paiseDivideRatio,
  qtyAdd,
  qtyEqual,
  qtySub,
  qtyTimesPaise,
  qtyTimesRatio,
  toMicroUnits,
} from "./quantity";

describe("toMicroUnits / fromMicroUnits", () => {
  it("round-trips 8dp crypto quantities", () => {
    expect(fromMicroUnits(toMicroUnits(0.12345678))).toBe(0.12345678);
    expect(fromMicroUnits(toMicroUnits(1))).toBe(1);
    expect(fromMicroUnits(toMicroUnits(0.5))).toBe(0.5);
  });

  it("rounds to 8dp on input (no fractional micro-units)", () => {
    // 0.123456789 → 0.12345679 (rounded)
    expect(toMicroUnits(0.123456789)).toBe(12345679);
  });

  it("rejects non-finite", () => {
    expect(() => toMicroUnits(Number.NaN)).toThrow();
    expect(() => toMicroUnits(Number.POSITIVE_INFINITY)).toThrow();
  });
});

describe("qtyAdd / qtySub / qtyEqual", () => {
  it("adds without float drift", () => {
    expect(qtyAdd(0.1, 0.2)).toBe(0.3);
    expect(qtyEqual(qtyAdd(0.1, 0.2), 0.3)).toBe(true);
  });
  it("subtracts to exact zero when expected", () => {
    expect(qtySub(0.5, 0.5)).toBe(0);
    expect(qtySub(0.12345678, 0.12345678)).toBe(0);
  });
});

describe("qtyTimesPaise — paise total from qty × paise price", () => {
  it("0.2 BTC × ₹60L (₹6,00,00,000 paise) = ₹12L paise = 12_000_000 paise", () => {
    // 0.2 BTC × 6_000_000_00 paise (₹60L) = 1_200_000_00 paise = ₹12L
    expect(qtyTimesPaise(0.2, 600_000_000)).toBe(120_000_000);
  });
  it("PRD acceptance: realized P&L 0.2 BTC at (60L − 50L) = ₹2L exact", () => {
    const buyPaise = 500_000_000; // ₹50L
    const sellPaise = 600_000_000; // ₹60L
    const pnl = qtyTimesPaise(0.2, sellPaise - buyPaise);
    expect(pnl).toBe(20_000_000); // ₹2L
  });
  it("rounds half-away to nearest paise", () => {
    // 0.12345678 × 50000 paise = 6172.839 → 6173 paise
    expect(qtyTimesPaise(0.12345678, 50000)).toBe(6173);
  });
  it("rejects non-integer paise", () => {
    expect(() => qtyTimesPaise(0.5, 100.5)).toThrow();
  });
});

describe("qtyTimesRatio — corporate action math", () => {
  it("2:1 split doubles the quantity", () => {
    expect(qtyTimesRatio(100, 2, 1)).toBe(200);
  });
  it("3:2 split → 1.5x quantity", () => {
    expect(qtyTimesRatio(100, 3, 2)).toBe(150);
  });
});

describe("paiseDivideRatio — per-unit cost adjustment", () => {
  it("2:1 split halves the unit cost (basis conserved)", () => {
    expect(paiseDivideRatio(20000, 2, 1)).toBe(10000);
  });
  it("3:2 split divides unit cost by 1.5", () => {
    expect(paiseDivideRatio(150, 3, 2)).toBe(100);
  });
});
