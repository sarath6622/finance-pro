import { NextResponse, type NextRequest } from "next/server";
import { connectMongo } from "@/lib/db/mongo";
import { requireSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http/errors";
import { RecurringRuleModel, TransactionModel } from "@/models";
import { obligationsQuery } from "@/lib/recurring/validate";
import { computeObligations, type RuleLite } from "@/lib/recurring";
import type { TxnLite } from "@/lib/balances/types";

export const dynamic = "force-dynamic";

function todayIstIso(): string {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const sp = req.nextUrl.searchParams;
    const q = obligationsQuery.parse({
      asOf: sp.get("asOf") ?? undefined,
      horizonDays: sp.get("horizonDays") ?? undefined,
    });
    const asOf = q.asOf ?? todayIstIso();
    await connectMongo();
    const [rules, txnsForRules] = await Promise.all([
      RecurringRuleModel.find({ status: { $in: ["active", "paused"] } }).lean(),
      TransactionModel.find(
        { recurringRuleId: { $exists: true, $ne: null }, isDeleted: false },
        {
          accountId: 1,
          valueDate: 1,
          flowType: 1,
          direction: 1,
          amountPaise: 1,
          isDeleted: 1,
          recurringRuleId: 1,
        },
      ).lean(),
    ]);
    const ruleLites: RuleLite[] = rules.map((r) => ({
      _id: String(r._id),
      label: r.label,
      accountId: String(r.accountId),
      ...(r.counterpartyId ? { counterpartyId: String(r.counterpartyId) } : {}),
      ...(r.categoryId ? { categoryId: String(r.categoryId) } : {}),
      flowType: r.flowType as RuleLite["flowType"],
      amountPaise: r.amountPaise,
      frequency: r.frequency as RuleLite["frequency"],
      ...(r.dayOfMonth !== undefined && r.dayOfMonth !== null
        ? { dayOfMonth: r.dayOfMonth }
        : {}),
      startDate: r.startDate,
      ...(r.endDate ? { endDate: r.endDate } : {}),
      arrearsPolicy: (r.arrearsPolicy as RuleLite["arrearsPolicy"]) ?? "accumulate",
      status: r.status as RuleLite["status"],
    }));
    const txnLites: TxnLite[] = txnsForRules.map((t) => ({
      _id: String(t._id),
      accountId: String(t.accountId),
      valueDate: t.valueDate,
      flowType: t.flowType as TxnLite["flowType"],
      direction: t.direction as TxnLite["direction"],
      amountPaise: t.amountPaise,
      isDeleted: t.isDeleted ?? false,
      ...(t.recurringRuleId ? { recurringRuleId: String(t.recurringRuleId) } : {}),
    }));
    const result = computeObligations(ruleLites, txnLites, asOf, q.horizonDays);
    return NextResponse.json({ asOf, ...result });
  } catch (e) {
    return errorResponse(e);
  }
}
