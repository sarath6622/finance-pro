import { describe, it, expect } from "vitest";
import {
  amortizationSchedule,
  emiForLoan,
  rupees,
  splitEmiPayment,
} from "./amortization";

describe("emiForLoan", () => {
  it("matches a known reducing-balance figure to the nearest paise", () => {
    // ₹10,00,000 @ 10% p.a. × 60 mo → EMI ≈ ₹21,247.04
    const emi = emiForLoan(rupees(1000000), 10, 60);
    // Within ±1 paise of the analytical value
    expect(Math.abs(emi - 2124704)).toBeLessThanOrEqual(1);
  });

  it("zero-interest loan splits principal evenly", () => {
    const emi = emiForLoan(rupees(120000), 0, 12);
    expect(emi).toBe(rupees(10000));
  });

  it("rejects bad inputs", () => {
    expect(() => emiForLoan(0, 10, 12)).toThrow();
    expect(() => emiForLoan(100, 10, 0)).toThrow();
    expect(() => emiForLoan(100, -1, 12)).toThrow();
  });
});

describe("amortizationSchedule", () => {
  it("closing balance is exactly zero", () => {
    const s = amortizationSchedule(rupees(1000000), 10, 60);
    const last = s.rows[s.rows.length - 1]!;
    expect(last.balancePaise).toBe(0);
  });

  it("Σ principalPaise === starting principal exactly", () => {
    const principal = rupees(1000000);
    const s = amortizationSchedule(principal, 10, 60);
    const totalPrincipal = s.rows.reduce((sum, r) => sum + r.principalPaise, 0);
    expect(totalPrincipal).toBe(principal);
  });

  it("Σ paymentPaise === Σ principal + Σ interest", () => {
    const s = amortizationSchedule(rupees(500000), 12, 36);
    const sumPayment = s.rows.reduce((sum, r) => sum + r.paymentPaise, 0);
    const sumPI =
      s.rows.reduce((sum, r) => sum + r.principalPaise, 0) +
      s.rows.reduce((sum, r) => sum + r.interestPaise, 0);
    expect(sumPayment).toBe(sumPI);
    expect(s.totalPaymentPaise).toBe(sumPayment);
    expect(s.totalInterestPaise).toBe(
      s.rows.reduce((sum, r) => sum + r.interestPaise, 0),
    );
  });

  it("interest portion shrinks while principal portion grows (E22)", () => {
    const s = amortizationSchedule(rupees(500000), 12, 36);
    // First row's interest > last row's interest; first row's principal < last row's principal.
    const first = s.rows[0]!;
    const last = s.rows[s.rows.length - 1]!;
    expect(first.interestPaise).toBeGreaterThan(last.interestPaise);
    expect(first.principalPaise).toBeLessThan(last.principalPaise);
  });

  it("zero-interest schedule has zero interest in every row", () => {
    const s = amortizationSchedule(rupees(120000), 0, 12);
    expect(s.rows.every((r) => r.interestPaise === 0)).toBe(true);
    expect(s.totalInterestPaise).toBe(0);
  });

  it("EMI override is respected, schedule still closes on zero", () => {
    const s = amortizationSchedule(rupees(1000000), 10, 60, rupees(25000));
    expect(s.emiPaise).toBe(rupees(25000));
    expect(s.rows[s.rows.length - 1]!.balancePaise).toBe(0);
  });
});

describe("splitEmiPayment (E22 — interest portion of an EMI)", () => {
  it("for a fresh ₹10L @ 10%, first EMI's interest is ₹8333", () => {
    // monthly rate 10/12% = 0.833…%; on ₹10,00,000 → ₹8,333
    const split = splitEmiPayment(rupees(21250), rupees(1000000), 10);
    expect(split.interestPaise).toBeCloseTo(833333, -1); // within 10 paise
    expect(split.interestPaise + split.principalPaise).toBe(rupees(21250));
  });

  it("when payment is less than the interest accrued, principal=0 (won't go negative)", () => {
    const split = splitEmiPayment(rupees(5000), rupees(1000000), 10);
    // payment < monthly interest → all goes to interest, principal=0
    expect(split.principalPaise).toBe(0);
    expect(split.interestPaise).toBe(rupees(5000));
  });

  it("at zero rate, the whole EMI is principal", () => {
    const split = splitEmiPayment(rupees(10000), rupees(120000), 0);
    expect(split.interestPaise).toBe(0);
    expect(split.principalPaise).toBe(rupees(10000));
  });

  it("rejects bad inputs", () => {
    expect(() => splitEmiPayment(0, 1000, 10)).toThrow();
    expect(() => splitEmiPayment(100, -1, 10)).toThrow();
    expect(() => splitEmiPayment(100, 1000, -5)).toThrow();
  });
});
