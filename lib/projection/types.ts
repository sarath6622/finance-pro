export interface ScheduleRow {
  monthIndex: number;
  paymentPaise: number;
  interestPaise: number;
  principalPaise: number;
  balancePaise: number;
}

export interface AmortizationSchedule {
  emiPaise: number;
  totalInterestPaise: number;
  totalPaymentPaise: number;
  rows: ScheduleRow[];
}

export interface LoanLite {
  _id: string;
  name: string;
  /** Outstanding principal AS OF the projection's start date (paise) */
  outstandingPaise: number;
  /** Nominal annual interest rate, e.g. 12 for 12% p.a. */
  interestRatePA: number;
  /** Contractual fixed EMI (paise). May be 0 for unscheduled cards. */
  emiPaise: number;
  /** Optional next due date (YYYY-MM-DD) for the calendar */
  nextDueDate?: string;
}

export type PayoffStrategy = "avalanche" | "snowball";

export interface PayoffMonth {
  monthIndex: number;
  perLoan: Array<{
    loanId: string;
    paymentPaise: number;
    interestPaise: number;
    principalPaise: number;
    balancePaise: number;
    finished: boolean;
  }>;
  totalPaymentPaise: number;
  totalInterestPaise: number;
  totalBalancePaise: number;
  freedEmiPaise: number;
}

export interface PayoffPlan {
  strategy: PayoffStrategy;
  totalMonths: number;
  totalInterestPaise: number;
  perLoan: Array<{
    loanId: string;
    name: string;
    payoffMonthIndex: number;
    interestPaidPaise: number;
  }>;
  months: PayoffMonth[];
}

export interface RedirectProjection {
  /** Months between strategy completion and the configured target horizon */
  redirectMonths: number;
  /** Per-month surplus freed once each loan is paid off (cumulative) */
  freedEmiTrailPaise: number[];
  /** If redirected to an investment line at this monthly amount */
  investedTotalPaise: number;
  /** Naive future-value at the supplied annual return */
  futureValuePaise: number;
}
