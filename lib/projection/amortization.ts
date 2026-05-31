import type { AmortizationSchedule, ScheduleRow } from "./types";

const PAISE_PER_RUPEE = 100;

/**
 * Standard reducing-balance EMI formula:
 *   EMI = P · r · (1+r)^n / ((1+r)^n − 1)
 * where r = monthly nominal rate (annualRate / 12), n = tenure.
 *
 * Returns the EMI rounded to the nearest paise. The schedule's last
 * payment absorbs the rounding drift so the closing balance is exactly 0.
 */
export function emiForLoan(
  principalPaise: number,
  annualRatePct: number,
  tenureMonths: number,
): number {
  if (principalPaise <= 0) throw new Error("principalPaise must be > 0");
  if (tenureMonths <= 0) throw new Error("tenureMonths must be > 0");
  if (annualRatePct < 0) throw new Error("annualRatePct must be >= 0");
  if (annualRatePct === 0) {
    // eslint-disable-next-line no-restricted-syntax -- zero-rate EMI; Math.round handles paise rounding
    return Math.round(principalPaise / tenureMonths);
  }
  // eslint-disable-next-line no-restricted-syntax -- standard EMI formula; rate math, not money
  const r = annualRatePct / 100 / 12;
  const pow = Math.pow(1 + r, tenureMonths);
  // eslint-disable-next-line no-restricted-syntax -- standard EMI formula; Math.round handles paise rounding
  const emi = (principalPaise * r * pow) / (pow - 1);
  return Math.round(emi);
}

/**
 * Build a full amortization schedule. Each row keeps integer paise; the
 * principal portion is computed last so monthly rounding doesn't drift.
 * The final payment is adjusted so `balancePaise` lands on 0.
 */
export function amortizationSchedule(
  principalPaise: number,
  annualRatePct: number,
  tenureMonths: number,
  emiOverridePaise?: number,
): AmortizationSchedule {
  const emi = emiOverridePaise ?? emiForLoan(principalPaise, annualRatePct, tenureMonths);
  const monthlyRate = annualRatePct / 100 / 12;
  const rows: ScheduleRow[] = [];
  let balance = principalPaise;
  let totalInterest = 0;
  let totalPayment = 0;

  for (let i = 1; i <= tenureMonths; i++) {
    const interest = Math.round(balance * monthlyRate);
    let payment = emi;
    let principal = payment - interest;
    let nextBalance = balance - principal;

    // Last month: collapse any rounding drift into the closing payment so the
    // balance lands exactly on zero. Same for any earlier month that would
    // otherwise leave a tiny positive balance smaller than the EMI.
    if (i === tenureMonths || nextBalance < 0) {
      principal = balance;
      payment = principal + interest;
      nextBalance = 0;
    }

    rows.push({
      monthIndex: i,
      paymentPaise: payment,
      interestPaise: interest,
      principalPaise: principal,
      balancePaise: nextBalance,
    });
    totalInterest += interest;
    totalPayment += payment;
    balance = nextBalance;
    if (balance === 0) break;
  }

  return {
    emiPaise: emi,
    totalInterestPaise: totalInterest,
    totalPaymentPaise: totalPayment,
    rows,
  };
}

/**
 * Given an actual EMI payment of `paymentPaise` against a loan with current
 * `outstandingPaise` at `annualRatePct`, return the principal/interest split.
 * Uses simple monthly interest accrual. Used to auto-split a `debt_repayment`
 * transaction into principal (liability ↓) and interest (cost flag).
 */
export function splitEmiPayment(
  paymentPaise: number,
  outstandingPaise: number,
  annualRatePct: number,
): { interestPaise: number; principalPaise: number } {
  if (paymentPaise <= 0) throw new Error("paymentPaise must be > 0");
  if (outstandingPaise < 0) throw new Error("outstandingPaise must be >= 0");
  if (annualRatePct < 0) throw new Error("annualRatePct must be >= 0");
  const monthlyRate = annualRatePct / 100 / 12;
  const interest = Math.round(outstandingPaise * monthlyRate);
  const cappedInterest = Math.min(interest, paymentPaise);
  const principal = paymentPaise - cappedInterest;
  return { interestPaise: cappedInterest, principalPaise: principal };
}

/** Helper for tests: convert rupees to paise for fixture readability. */
export function rupees(n: number): number {
  return Math.round(n * PAISE_PER_RUPEE);
}
