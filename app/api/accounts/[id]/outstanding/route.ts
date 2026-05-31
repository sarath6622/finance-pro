import { NextResponse, type NextRequest } from "next/server";
import { connectMongo } from "@/lib/db/mongo";
import { requireSession } from "@/lib/auth/session";
import { errorResponse, notFound, validation } from "@/lib/http/errors";
import { AccountModel, TransactionModel } from "@/models";
import {
  loanInterestTotalsInRange,
  loanOutstandingAt,
} from "@/lib/projection/loan-balance";
import type { TxnLite } from "@/lib/balances/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireSession();
    await connectMongo();
    const loan = await AccountModel.findById(params.id).lean();
    if (!loan) throw notFound("Account not found");
    if (loan.kind !== "loan") {
      throw validation(`Account ${params.id} is not a loan (kind=${loan.kind})`);
    }
    const sp = req.nextUrl.searchParams;
    const from = sp.get("from") ?? undefined;
    const to = sp.get("to") ?? undefined;
    const txns = await TransactionModel.find(
      { debtAccountId: loan._id, isDeleted: false },
      { _id: 1, accountId: 1, valueDate: 1, flowType: 1, direction: 1, amountPaise: 1, interestPortionPaise: 1 },
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
    const totals = from && to
      ? loanInterestTotalsInRange(
          { _id: String(loan._id), openingBalancePaise: loan.openingBalancePaise },
          lite,
          from,
          to,
        )
      : undefined;
    return NextResponse.json({
      accountId: String(loan._id),
      openingBalancePaise: loan.openingBalancePaise,
      outstandingPaise: outstanding,
      interestRatePA: loan.interestRatePA,
      emiAmountPaise: loan.emiAmountPaise,
      tenureMonths: loan.tenureMonths,
      rangeTotals: totals,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
