import type {
  LoanLite,
  PayoffMonth,
  PayoffPlan,
  PayoffStrategy,
  RedirectProjection,
} from "./types";

const MAX_PROJECTION_MONTHS = 600; // 50 years — guard against runaway loops

interface LoanState {
  loan: LoanLite;
  balance: number;
  interestPaid: number;
  payoffMonthIndex: number; // 0 = not yet
}

/**
 * Order loans for the chosen strategy. Avalanche pays highest rate first;
 * Snowball pays smallest balance first. Both fall back to original list order
 * for ties so projections stay deterministic.
 */
function orderForStrategy(
  states: LoanState[],
  strategy: PayoffStrategy,
): LoanState[] {
  const indexed = states.map((s, i) => ({ s, i }));
  if (strategy === "avalanche") {
    indexed.sort((a, b) => {
      const diff = b.s.loan.interestRatePA - a.s.loan.interestRatePA;
      if (diff !== 0) return diff;
      return a.i - b.i;
    });
  } else {
    indexed.sort((a, b) => {
      const diff = a.s.balance - b.s.balance;
      if (diff !== 0) return diff;
      return a.i - b.i;
    });
  }
  return indexed.map(({ s }) => s);
}

/**
 * Project payoff month-by-month. Each month:
 *   1. accrue interest on every live loan (rate / 12 of current balance).
 *   2. pay the contractual EMI on every live loan (capped at balance + interest).
 *   3. apply the entire monthly surplus to a single "extra-payment" target,
 *      chosen by strategy. Any EMI freed when a loan closes rolls into next
 *      month's surplus (the avalanche/snowball cascade).
 *
 * Avalanche vs snowball is purely the choice of extra-payment target.
 */
export function projectPayoff(
  loans: LoanLite[],
  surplusPerMonthPaise: number,
  strategy: PayoffStrategy,
  opts: { maxMonths?: number } = {},
): PayoffPlan {
  if (surplusPerMonthPaise < 0) {
    throw new Error("surplusPerMonthPaise must be >= 0");
  }
  const cap = Math.min(MAX_PROJECTION_MONTHS, opts.maxMonths ?? MAX_PROJECTION_MONTHS);
  const states: LoanState[] = loans.map((l) => ({
    loan: l,
    balance: l.outstandingPaise,
    interestPaid: 0,
    payoffMonthIndex: l.outstandingPaise <= 0 ? 0 : 0,
  }));
  const months: PayoffMonth[] = [];

  for (let m = 1; m <= cap; m++) {
    const live = states.filter((s) => s.balance > 0);
    if (live.length === 0) break;

    // Cascade: freed EMI from any loan closed in PRIOR months rolls into surplus.
    const freedEmi = states
      .filter((s) => s.balance === 0 && s.payoffMonthIndex > 0 && s.payoffMonthIndex < m)
      .reduce((sum, s) => sum + s.loan.emiPaise, 0);
    let surplusBudget = surplusPerMonthPaise + freedEmi;

    // 1+2: accrue interest + apply contractual EMI on every live loan.
    const perMonth: PayoffMonth["perLoan"] = [];
    for (const s of live) {
      const monthlyRate = s.loan.interestRatePA / 100 / 12;
      const interest = Math.round(s.balance * monthlyRate);
      const contractual = Math.min(s.loan.emiPaise, s.balance + interest);
      const principal = Math.max(0, contractual - interest);
      s.balance = Math.max(0, s.balance - principal);
      s.interestPaid += interest;
      perMonth.push({
        loanId: s.loan._id,
        paymentPaise: contractual,
        interestPaise: interest,
        principalPaise: principal,
        balancePaise: s.balance,
        finished: false,
      });
      if (s.balance === 0) s.payoffMonthIndex = m;
    }

    // 3: apply surplus to extra-payment target(s), cascading if a target closes.
    const stillLive = () => states.filter((st) => st.balance > 0);
    while (surplusBudget > 0) {
      const candidates = stillLive();
      if (candidates.length === 0) break;
      const ordered = orderForStrategy(candidates, strategy);
      const target = ordered[0];
      if (!target) break;
      const apply = Math.min(surplusBudget, target.balance);
      target.balance -= apply;
      surplusBudget -= apply;
      const row = perMonth.find((p) => p.loanId === target.loan._id);
      if (row) {
        row.paymentPaise += apply;
        row.principalPaise += apply;
        row.balancePaise = target.balance;
      }
      if (target.balance === 0 && target.payoffMonthIndex === 0) {
        target.payoffMonthIndex = m;
        const finishedRow = perMonth.find((p) => p.loanId === target.loan._id);
        if (finishedRow) finishedRow.finished = true;
      }
    }

    // Mark `finished` for any loan that closed this month (contractual or surplus).
    for (const row of perMonth) {
      const s = states.find((st) => st.loan._id === row.loanId);
      if (s && s.balance === 0 && s.payoffMonthIndex === m) {
        row.finished = true;
        row.balancePaise = 0;
      }
    }

    months.push({
      monthIndex: m,
      perLoan: perMonth,
      totalPaymentPaise: perMonth.reduce((s, r) => s + r.paymentPaise, 0),
      totalInterestPaise: perMonth.reduce((s, r) => s + r.interestPaise, 0),
      totalBalancePaise: states.reduce((s, st) => s + st.balance, 0),
      freedEmiPaise: freedEmi,
    });
  }

  const debtFreeMonth = months.length;
  return {
    strategy,
    totalMonths: debtFreeMonth,
    totalInterestPaise: states.reduce((s, st) => s + st.interestPaid, 0),
    perLoan: states.map((s) => ({
      loanId: s.loan._id,
      name: s.loan.name,
      payoffMonthIndex: s.payoffMonthIndex,
      interestPaidPaise: s.interestPaid,
    })),
    months,
  };
}

export function avalanche(loans: LoanLite[], surplusPerMonthPaise: number): PayoffPlan {
  return projectPayoff(loans, surplusPerMonthPaise, "avalanche");
}
export function snowball(loans: LoanLite[], surplusPerMonthPaise: number): PayoffPlan {
  return projectPayoff(loans, surplusPerMonthPaise, "snowball");
}

/**
 * After the debt strategy completes at month T, project investing the freed
 * EMIs (or some `redirectMonthlyPaise`) at `annualReturnPct` until the
 * `horizonMonths` target (e.g., 24 months past debt-free).
 *
 *   FV = Σ contribution × (1 + r)^(horizon − i)   (paid at month-end)
 */
export function redirectProjection(
  plan: PayoffPlan,
  redirectMonthlyPaise: number,
  annualReturnPct: number,
  horizonMonths: number,
): RedirectProjection {
  if (horizonMonths <= 0) {
    return {
      redirectMonths: 0,
      freedEmiTrailPaise: [],
      investedTotalPaise: 0,
      futureValuePaise: 0,
    };
  }
  if (annualReturnPct < 0) throw new Error("annualReturnPct must be >= 0");
  const r = annualReturnPct / 100 / 12;
  let invested = 0;
  let fv = 0;
  for (let i = 1; i <= horizonMonths; i++) {
    invested += redirectMonthlyPaise;
    // Compound prior balance + add this month's contribution at end of month
    fv = Math.round(fv * (1 + r)) + redirectMonthlyPaise;
  }
  return {
    redirectMonths: horizonMonths,
    freedEmiTrailPaise: plan.months.map((m) => m.freedEmiPaise),
    investedTotalPaise: invested,
    futureValuePaise: fv,
  };
}

export interface PayoffComparison {
  avalanche: PayoffPlan;
  snowball: PayoffPlan;
  monthsDifferential: number;
  interestDifferentialPaise: number;
  recommendation: "avalanche" | "snowball" | "tied";
}

export function comparePayoff(
  loans: LoanLite[],
  surplusPerMonthPaise: number,
): PayoffComparison {
  const a = avalanche(loans, surplusPerMonthPaise);
  const s = snowball(loans, surplusPerMonthPaise);
  const monthsDifferential = s.totalMonths - a.totalMonths;
  const interestDifferentialPaise = s.totalInterestPaise - a.totalInterestPaise;
  let recommendation: PayoffComparison["recommendation"] = "tied";
  if (interestDifferentialPaise > 100 || monthsDifferential > 0) recommendation = "avalanche";
  else if (interestDifferentialPaise < -100 || monthsDifferential < 0) recommendation = "snowball";
  return {
    avalanche: a,
    snowball: s,
    monthsDifferential,
    interestDifferentialPaise,
    recommendation,
  };
}
