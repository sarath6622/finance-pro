import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { connectMongo } from "@/lib/db/mongo";
import { requireSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http/errors";
import { AccountModel, TransactionModel } from "@/models";
import { comparePayoff, redirectProjection } from "@/lib/projection/payoff";
import { loanOutstandingAt } from "@/lib/projection/loan-balance";
import type { LoanLite } from "@/lib/projection/types";
import type { TxnLite } from "@/lib/balances/types";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  surplusPerMonthPaise: z.coerce.number().int().min(0).default(0),
  redirectAnnualReturnPct: z.coerce.number().min(0).max(40).optional(),
  redirectHorizonMonths: z.coerce.number().int().min(0).max(600).optional(),
});

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const sp = req.nextUrl.searchParams;
    const q = querySchema.parse({
      surplusPerMonthPaise: sp.get("surplusPerMonthPaise") ?? undefined,
      redirectAnnualReturnPct: sp.get("redirectAnnualReturnPct") ?? undefined,
      redirectHorizonMonths: sp.get("redirectHorizonMonths") ?? undefined,
    });
    await connectMongo();
    const loanDocs = await AccountModel.find({
      kind: "loan",
      isActive: true,
    }).lean();
    if (loanDocs.length === 0) {
      return NextResponse.json({
        loans: [],
        avalanche: null,
        snowball: null,
        recommendation: "tied",
      });
    }
    const txnDocs = await TransactionModel.find(
      {
        debtAccountId: { $in: loanDocs.map((d) => d._id) },
        isDeleted: false,
      },
      { _id: 1, accountId: 1, valueDate: 1, flowType: 1, direction: 1, amountPaise: 1, debtAccountId: 1, interestPortionPaise: 1 },
    ).lean();
    const lite: TxnLite[] = txnDocs.map((t) => ({
      _id: String(t._id),
      accountId: String(t.accountId),
      valueDate: t.valueDate,
      flowType: t.flowType as TxnLite["flowType"],
      direction: t.direction as TxnLite["direction"],
      amountPaise: t.amountPaise,
      isDeleted: false,
      ...(t.debtAccountId ? { debtAccountId: String(t.debtAccountId) } : {}),
      ...(t.interestPortionPaise !== undefined && t.interestPortionPaise !== null
        ? { interestPortionPaise: t.interestPortionPaise }
        : {}),
    }));

    const loans: LoanLite[] = loanDocs
      .filter((d) => d.interestRatePA !== undefined && d.emiAmountPaise)
      .map((d) => {
        const outstanding = loanOutstandingAt(
          { _id: String(d._id), openingBalancePaise: d.openingBalancePaise },
          lite,
        );
        return {
          _id: String(d._id),
          name: d.name,
          outstandingPaise: outstanding,
          interestRatePA: d.interestRatePA ?? 0,
          emiPaise: d.emiAmountPaise ?? 0,
        };
      });

    const cmp = comparePayoff(loans, q.surplusPerMonthPaise);
    const totalEmi = loans.reduce((s, l) => s + l.emiPaise, 0);
    const redirect =
      q.redirectHorizonMonths && q.redirectAnnualReturnPct !== undefined
        ? redirectProjection(
            cmp.avalanche,
            totalEmi + q.surplusPerMonthPaise,
            q.redirectAnnualReturnPct,
            q.redirectHorizonMonths,
          )
        : undefined;

    return NextResponse.json({
      asOf: new Date().toISOString().slice(0, 10),
      surplusPerMonthPaise: q.surplusPerMonthPaise,
      loans,
      avalanche: cmp.avalanche,
      snowball: cmp.snowball,
      monthsDifferential: cmp.monthsDifferential,
      interestDifferentialPaise: cmp.interestDifferentialPaise,
      recommendation: cmp.recommendation,
      redirect,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
