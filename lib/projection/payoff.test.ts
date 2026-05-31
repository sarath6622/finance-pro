import { describe, it, expect } from "vitest";
import { avalanche, comparePayoff, projectPayoff, redirectProjection, snowball } from "./payoff";
import { rupees } from "./amortization";
import type { LoanLite } from "./types";

function loan(
  id: string,
  outstanding: number,
  ratePA: number,
  emi: number,
  name = id,
): LoanLite {
  return {
    _id: id,
    name,
    outstandingPaise: outstanding,
    interestRatePA: ratePA,
    emiPaise: emi,
  };
}

describe("projectPayoff — base case", () => {
  it("a single 0% loan of ₹12,000 / ₹1,000 EMI closes in 12 months", () => {
    const plan = projectPayoff([loan("L", rupees(12000), 0, rupees(1000))], 0, "avalanche");
    expect(plan.totalMonths).toBe(12);
    expect(plan.totalInterestPaise).toBe(0);
    expect(plan.perLoan[0]!.payoffMonthIndex).toBe(12);
    expect(plan.months[plan.months.length - 1]!.totalBalancePaise).toBe(0);
  });

  it("surplus added every month accelerates payoff", () => {
    const loans = [loan("L", rupees(120000), 12, rupees(2000))];
    const noSurplus = projectPayoff(loans, 0, "avalanche");
    const withSurplus = projectPayoff(loans, rupees(5000), "avalanche");
    expect(withSurplus.totalMonths).toBeLessThan(noSurplus.totalMonths);
  });

  it("rejects negative surplus", () => {
    expect(() => projectPayoff([], -1, "avalanche")).toThrow();
  });

  it("returns an empty plan when no loans are passed", () => {
    const plan = projectPayoff([], 1000, "avalanche");
    expect(plan.totalMonths).toBe(0);
    expect(plan.months).toEqual([]);
  });

  it("loans already at zero are treated as instantly paid", () => {
    const plan = projectPayoff([loan("L", 0, 12, rupees(1000))], 0, "avalanche");
    expect(plan.totalMonths).toBe(0);
  });
});

describe("avalanche vs snowball — strategy correctness", () => {
  // Classic textbook setup: two loans, surplus rolled into highest-rate first
  // (avalanche) saves more interest than smallest-balance first (snowball).
  const loanA = loan("A", rupees(200000), 18, rupees(5000), "A — small high-rate"); // ₹2L @ 18%
  const loanB = loan("B", rupees(300000), 10, rupees(6000), "B — bigger low-rate"); // ₹3L @ 10%
  const surplus = rupees(5000);

  it("avalanche targets the higher-rate loan first", () => {
    const plan = avalanche([loanA, loanB], surplus);
    const aIdx = plan.perLoan.find((p) => p.loanId === "A")!.payoffMonthIndex;
    const bIdx = plan.perLoan.find((p) => p.loanId === "B")!.payoffMonthIndex;
    expect(aIdx).toBeLessThanOrEqual(bIdx);
  });

  it("snowball targets the smallest balance first", () => {
    const big = loan("BIG", rupees(500000), 18, rupees(8000));
    const small = loan("SMALL", rupees(50000), 10, rupees(2000));
    const plan = snowball([big, small], rupees(3000));
    const smallIdx = plan.perLoan.find((p) => p.loanId === "SMALL")!.payoffMonthIndex;
    const bigIdx = plan.perLoan.find((p) => p.loanId === "BIG")!.payoffMonthIndex;
    expect(smallIdx).toBeLessThan(bigIdx);
  });

  it("avalanche pays less total interest than snowball when rates diverge", () => {
    const cmp = comparePayoff([loanA, loanB], surplus);
    expect(cmp.avalanche.totalInterestPaise).toBeLessThanOrEqual(
      cmp.snowball.totalInterestPaise,
    );
    expect(cmp.recommendation).not.toBe("snowball");
  });

  it("comparePayoff surfaces interest + months differentials", () => {
    const cmp = comparePayoff([loanA, loanB], surplus);
    expect(cmp.monthsDifferential).toBe(cmp.snowball.totalMonths - cmp.avalanche.totalMonths);
    expect(cmp.interestDifferentialPaise).toBe(
      cmp.snowball.totalInterestPaise - cmp.avalanche.totalInterestPaise,
    );
  });
});

describe("freed-EMI cascade", () => {
  it("after the small loan closes, its EMI rolls into next month's surplus budget", () => {
    const small = loan("S", rupees(20000), 0, rupees(10000)); // closes in 2 months
    const big = loan("B", rupees(200000), 12, rupees(5000));
    const plan = projectPayoff([small, big], 0, "avalanche", { maxMonths: 60 });
    // Find first month after the small loan is paid → freedEmiPaise should jump
    const smallClose = plan.months.find((m) =>
      m.perLoan.some((p) => p.loanId === "S" && p.finished),
    )!;
    const afterClose = plan.months[smallClose.monthIndex] ?? plan.months[plan.months.length - 1]!;
    expect(afterClose.freedEmiPaise).toBeGreaterThanOrEqual(rupees(10000));
  });
});

describe("redirectProjection — after debt-free, redirect EMI to investing", () => {
  it("zero return: future value equals contributions", () => {
    const plan = avalanche([loan("L", rupees(60000), 0, rupees(10000))], 0);
    const fv = redirectProjection(plan, rupees(10000), 0, 12);
    expect(fv.futureValuePaise).toBe(rupees(120000));
    expect(fv.investedTotalPaise).toBe(rupees(120000));
  });

  it("12% return on ₹10,000/mo × 12mo ≈ ₹1,26,825 (analytical FV)", () => {
    const plan = avalanche([loan("L", rupees(60000), 0, rupees(10000))], 0);
    const fv = redirectProjection(plan, rupees(10000), 12, 12);
    // Analytical annuity-end FV = C × ((1+r)^n − 1)/r where C=₹10,000/mo, r=1%, n=12.
    // = ₹10,000 × 12.682503 ≈ ₹1,26,825 → 12_682_503 paise.
    expect(Math.abs(fv.futureValuePaise - 12_682_503)).toBeLessThan(1000);
    expect(fv.investedTotalPaise).toBe(rupees(120000));
    expect(fv.futureValuePaise).toBeGreaterThan(fv.investedTotalPaise);
  });

  it("horizon = 0 → empty projection", () => {
    const plan = avalanche([loan("L", rupees(60000), 0, rupees(10000))], 0);
    const fv = redirectProjection(plan, rupees(10000), 12, 0);
    expect(fv.futureValuePaise).toBe(0);
    expect(fv.investedTotalPaise).toBe(0);
  });
});

describe("total balance only decreases over time", () => {
  it("balance is monotonically non-increasing month-to-month", () => {
    const plan = avalanche(
      [
        loan("A", rupees(100000), 18, rupees(3000)),
        loan("B", rupees(200000), 10, rupees(4000)),
      ],
      rupees(2000),
    );
    for (let i = 1; i < plan.months.length; i++) {
      const prev = plan.months[i - 1]!;
      const cur = plan.months[i]!;
      expect(cur.totalBalancePaise).toBeLessThanOrEqual(prev.totalBalancePaise);
    }
  });
});
