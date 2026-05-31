import { describe, it, expect } from "vitest";
import { Money } from "./money";

describe("Money construction", () => {
  it("fromPaise accepts integers", () => {
    expect(Money.fromPaise(0).paise).toBe(0);
    expect(Money.fromPaise(12345).paise).toBe(12345);
    expect(Money.fromPaise(-100).paise).toBe(-100);
  });

  it("fromPaise rejects non-integers and non-finite", () => {
    expect(() => Money.fromPaise(1.5)).toThrow();
    expect(() => Money.fromPaise(NaN)).toThrow();
    expect(() => Money.fromPaise(Infinity)).toThrow();
  });

  it("parse handles plain integers and decimals", () => {
    expect(Money.parse("100").paise).toBe(10000);
    expect(Money.parse("100.50").paise).toBe(10050);
    expect(Money.parse("0.01").paise).toBe(1);
  });

  it("parse handles Indian grouping with rupee symbol", () => {
    expect(Money.parse("₹1,00,000.00").paise).toBe(10000000);
    expect(Money.parse("1,23,456.78").paise).toBe(12345678);
  });

  it("parse handles negatives", () => {
    expect(Money.parse("-100").paise).toBe(-10000);
    expect(Money.parse("-₹50.25").paise).toBe(-5025);
  });

  it("parse rejects garbage input", () => {
    expect(() => Money.parse("abc")).toThrow();
    expect(() => Money.parse("")).toThrow();
    expect(() => Money.parse("1.2.3")).toThrow();
    expect(() => Money.parse("-")).toThrow();
  });

  it("parse rounds half-even when fractional > 2 digits", () => {
    expect(Money.parse("1.005").paise).toBe(100); // 0.5 → even 0
    expect(Money.parse("1.015").paise).toBe(102); // 0.5 → even 2
    expect(Money.parse("1.014").paise).toBe(101);
    expect(Money.parse("1.016").paise).toBe(102);
    expect(Money.parse("1.0151").paise).toBe(102); // 0.51 → up
  });

  it("fromRupees forwards to parse", () => {
    expect(Money.fromRupees(100).paise).toBe(10000);
    expect(Money.fromRupees("100.50").paise).toBe(10050);
    expect(() => Money.fromRupees(NaN)).toThrow();
  });

  it("zero", () => {
    expect(Money.zero().paise).toBe(0);
    expect(Money.zero().isZero()).toBe(true);
  });
});

describe("Money arithmetic — protects against float drift (E17)", () => {
  it("0.10 + 0.20 sums exactly to 0.30 in paise", () => {
    const a = Money.parse("0.10");
    const b = Money.parse("0.20");
    const sum = a.add(b);
    expect(sum.paise).toBe(30);
    expect(sum.eq(Money.parse("0.30"))).toBe(true);
  });

  it("add / sub round-trip", () => {
    const a = Money.fromPaise(12345);
    const b = Money.fromPaise(6789);
    expect(a.add(b).sub(b).eq(a)).toBe(true);
  });

  it("neg and abs", () => {
    expect(Money.fromPaise(-50).abs().paise).toBe(50);
    expect(Money.fromPaise(50).neg().paise).toBe(-50);
    expect(Money.fromPaise(0).neg().paise).toBe(0);
  });

  it("mul requires integer scalar", () => {
    expect(Money.fromPaise(100).mul(3).paise).toBe(300);
    expect(Money.fromPaise(100).mul(-2).paise).toBe(-200);
    expect(() => Money.fromPaise(100).mul(2.5)).toThrow();
  });

  it("mulRate banker-rounds halves to even", () => {
    expect(Money.fromPaise(100).mulRate(0.075).paise).toBe(8); // 7.5 → 8 (even)
    expect(Money.fromPaise(100).mulRate(0.065).paise).toBe(6); // 6.5 → 6 (even)
    expect(Money.fromPaise(100).mulRate(0.07).paise).toBe(7);
    expect(() => Money.fromPaise(100).mulRate(NaN)).toThrow();
  });

  it("divInt returns quotient and signed remainder", () => {
    const { quotient, remainderPaise } = Money.fromPaise(100).divInt(3);
    expect(quotient.paise).toBe(33);
    expect(remainderPaise).toBe(1);
    const neg = Money.fromPaise(-100).divInt(3);
    expect(neg.quotient.paise).toBe(-33);
    expect(neg.remainderPaise).toBe(-1);
  });

  it("divInt rejects zero divisor and non-integer", () => {
    expect(() => Money.fromPaise(100).divInt(0)).toThrow();
    expect(() => Money.fromPaise(100).divInt(1.5)).toThrow();
  });
});

describe("Money splitting — preserves exact sum (P5 splits, FR-19)", () => {
  it("splitEqually preserves sum exactly", () => {
    const parts = Money.fromPaise(100).splitEqually(3);
    const sum = parts.reduce((a, b) => a.add(b), Money.zero());
    expect(sum.paise).toBe(100);
    expect(parts.map((p) => p.paise).sort((a, b) => a - b)).toEqual([33, 33, 34]);
  });

  it("splitEqually handles even division (turf: 1500 / 6)", () => {
    const parts = Money.fromPaise(150000).splitEqually(6);
    expect(parts.every((p) => p.paise === 25000)).toBe(true);
  });

  it("splitEqually handles negative amounts", () => {
    const parts = Money.fromPaise(-100).splitEqually(3);
    const sum = parts.reduce((a, b) => a.add(b), Money.zero());
    expect(sum.paise).toBe(-100);
    expect(parts.map((p) => p.paise).sort((a, b) => a - b)).toEqual([-34, -33, -33]);
  });

  it("splitEqually validates input", () => {
    expect(() => Money.fromPaise(100).splitEqually(0)).toThrow();
    expect(() => Money.fromPaise(100).splitEqually(-1)).toThrow();
    expect(() => Money.fromPaise(100).splitEqually(1.5)).toThrow();
  });

  it("splitByShares allocates by weights with exact sum", () => {
    const parts = Money.fromPaise(1000).splitByShares([1, 2, 3]);
    const sum = parts.reduce((a, b) => a.add(b), Money.zero());
    expect(sum.paise).toBe(1000);
    const sorted = parts.map((p) => p.paise).sort((a, b) => a - b);
    expect(sorted).toEqual([167, 333, 500]);
  });

  it("splitByShares allows zero shares", () => {
    const parts = Money.fromPaise(900).splitByShares([1, 0, 2]);
    expect(parts.map((p) => p.paise)).toEqual([300, 0, 600]);
  });

  it("splitByShares rejects all-zero shares and negatives", () => {
    expect(() => Money.fromPaise(100).splitByShares([0, 0])).toThrow();
    expect(() => Money.fromPaise(100).splitByShares([-1, 2])).toThrow();
    expect(() => Money.fromPaise(100).splitByShares([])).toThrow();
  });

  it("splitByShares preserves sum for negative totals", () => {
    const parts = Money.fromPaise(-1000).splitByShares([1, 2, 3]);
    const sum = parts.reduce((a, b) => a.add(b), Money.zero());
    expect(sum.paise).toBe(-1000);
  });
});

describe("Money comparison", () => {
  const a = Money.fromPaise(100);
  const b = Money.fromPaise(200);
  it("eq / lt / lte / gt / gte", () => {
    expect(a.lt(b)).toBe(true);
    expect(a.lte(a)).toBe(true);
    expect(b.gt(a)).toBe(true);
    expect(b.gte(b)).toBe(true);
    expect(a.eq(Money.fromPaise(100))).toBe(true);
    expect(a.gt(b)).toBe(false);
  });
  it("isZero / isPositive / isNegative", () => {
    expect(Money.zero().isZero()).toBe(true);
    expect(a.isPositive()).toBe(true);
    expect(Money.fromPaise(-1).isNegative()).toBe(true);
    expect(Money.zero().isPositive()).toBe(false);
    expect(Money.zero().isNegative()).toBe(false);
  });
});

describe("Money formatting (E25 Indian grouping)", () => {
  it("formats sub-rupee", () => {
    expect(Money.fromPaise(5).format()).toBe("₹0.05");
  });
  it("formats whole rupees", () => {
    expect(Money.fromPaise(10000).format()).toBe("₹100.00");
  });
  it("groups Indian style at 1 lakh", () => {
    expect(Money.fromPaise(10000000).format()).toBe("₹1,00,000.00");
  });
  it("groups Indian style at 10 lakh", () => {
    expect(Money.fromPaise(100000000).format()).toBe("₹10,00,000.00");
  });
  it("groups Indian style at 1 crore", () => {
    expect(Money.fromPaise(1000000000).format()).toBe("₹1,00,00,000.00");
  });
  it("formats negatives", () => {
    expect(Money.fromPaise(-12345).format()).toBe("-₹123.45");
  });
  it("respects withSymbol=false", () => {
    expect(Money.fromPaise(10000).format({ withSymbol: false })).toBe("100.00");
  });
  it("respects signed=true for positives", () => {
    expect(Money.fromPaise(100).format({ signed: true })).toBe("+₹1.00");
    expect(Money.fromPaise(-100).format({ signed: true })).toBe("-₹1.00");
  });
  it("toString matches format()", () => {
    const m = Money.fromPaise(123456);
    expect(m.toString()).toBe(m.format());
  });
  it("toJSON returns paise int (S5: balances are derived, paise is wire format)", () => {
    expect(JSON.stringify({ amt: Money.fromPaise(150) })).toBe('{"amt":150}');
  });
  it("parse → format round-trip", () => {
    const inputs = ["₹1,00,000.00", "₹50.25", "-₹100.00", "₹0.01"];
    for (const s of inputs) {
      expect(Money.parse(s).format()).toBe(s);
    }
  });
});
