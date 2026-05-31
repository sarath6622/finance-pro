import { NextResponse, type NextRequest } from "next/server";
import { connectMongo } from "@/lib/db/mongo";
import { requireSession } from "@/lib/auth/session";
import { errorResponse, notFound, validation } from "@/lib/http/errors";
import { AccountModel, TransactionModel } from "@/models";
import { amortizationSchedule } from "@/lib/projection/amortization";
import { loanOutstandingAt } from "@/lib/projection/loan-balance";
import type { TxnLite } from "@/lib/balances/types";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireSession();
    await connectMongo();
    const loan = await AccountModel.findById(params.id).lean();
    if (!loan) throw notFound("Account not found");
    if (loan.kind !== "loan") {
      throw validation(`Account ${params.id} is not a loan (kind=${loan.kind})`);
    }
    if (
      loan.interestRatePA === undefined ||
      loan.interestRatePA === null ||
      loan.tenureMonths === undefined ||
      loan.tenureMonths === null
    ) {
      throw validation(
        "Loan account is missing interestRatePA or tenureMonths — set those first",
      );
    }
    const ratePA: number = loan.interestRatePA;
    const tenureMonths: number = loan.tenureMonths;
    const emiPaise: number | undefined =
      loan.emiAmountPaise === undefined || loan.emiAmountPaise === null
        ? undefined
        : loan.emiAmountPaise;
    const txns = await TransactionModel.find(
      { debtAccountId: loan._id, isDeleted: false },
      { _id: 1, accountId: 1, valueDate: 1, flowType: 1, direction: 1, amountPaise: 1, interestPortionPaise: 1, debtAccountId: 1 },
    ).lean();
    const lite: TxnLite[] = txns.map((t) => ({
      _id: String(t._id),
      accountId: String(t.accountId),
      valueDate: t.valueDate,
      flowType: t.flowType as TxnLite["flowType"],
      direction: t.direction as TxnLite["direction"],
      amountPaise: t.amountPaise,
      isDeleted: false,
      debtAccountId: String(loan._id),
      ...(t.interestPortionPaise !== undefined && t.interestPortionPaise !== null
        ? { interestPortionPaise: t.interestPortionPaise }
        : {}),
    }));
    const outstanding = loanOutstandingAt(
      { _id: String(loan._id), openingBalancePaise: loan.openingBalancePaise },
      lite,
    );
    const contractual = amortizationSchedule(
      loan.openingBalancePaise,
      ratePA,
      tenureMonths,
      emiPaise,
    );
    // Schedule from "today" forward, anchored on the remaining principal at the
    // contractual interest rate over a tenure approximated from the EMI.
    const monthlyRate = ratePA / 100 / 12;
    let remainingMonthsEst = tenureMonths;
    if (emiPaise && outstanding > 0 && monthlyRate > 0) {
      const n =
        Math.log(emiPaise / (emiPaise - outstanding * monthlyRate)) /
        Math.log(1 + monthlyRate);
      remainingMonthsEst = Math.max(1, Math.ceil(n));
    } else if (outstanding > 0 && emiPaise) {
      remainingMonthsEst = Math.ceil(outstanding / emiPaise);
    }
    const forward = outstanding > 0
      ? amortizationSchedule(outstanding, ratePA, remainingMonthsEst, emiPaise)
      : null;

    return NextResponse.json({
      account: {
        _id: String(loan._id),
        name: loan.name,
        openingBalancePaise: loan.openingBalancePaise,
        interestRatePA: loan.interestRatePA,
        tenureMonths: loan.tenureMonths,
        emiAmountPaise: loan.emiAmountPaise,
      },
      outstandingPaise: outstanding,
      contractual,
      remaining: forward,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
