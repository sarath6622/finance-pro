import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { connectMongo } from "@/lib/db/mongo";
import { requireSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http/errors";
import { RecurringRuleModel, TransactionModel } from "@/models";
import { computeObligations, type RuleLite } from "@/lib/recurring";
import { buildEmiCalendar } from "@/lib/reports/emi-calendar";
import type { TxnLite } from "@/lib/balances/types";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  asOf: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "asOf must be YYYY-MM-DD")
    .optional(),
  horizonDays: z.coerce.number().int().min(1).max(720).default(180),
});

function todayIst(): string {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const sp = req.nextUrl.searchParams;
    const q = querySchema.parse({
      asOf: sp.get("asOf") ?? undefined,
      horizonDays: sp.get("horizonDays") ?? undefined,
    });
    const asOf = q.asOf ?? todayIst();
    await connectMongo();

    const [rules, txns] = await Promise.all([
      RecurringRuleModel.find({
        flowType: "debt_repayment",
        status: { $in: ["active", "paused"] },
      }).lean(),
      TransactionModel.find(
        { recurringRuleId: { $exists: true, $ne: null }, isDeleted: false },
        {
          _id: 1,
          accountId: 1,
          valueDate: 1,
          flowType: 1,
          direction: 1,
          amountPaise: 1,
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
    const txnLites: TxnLite[] = txns.map((t) => ({
      _id: String(t._id),
      accountId: String(t.accountId),
      valueDate: t.valueDate,
      flowType: t.flowType as TxnLite["flowType"],
      direction: t.direction as TxnLite["direction"],
      amountPaise: t.amountPaise,
      isDeleted: false,
      ...(t.recurringRuleId ? { recurringRuleId: String(t.recurringRuleId) } : {}),
    }));
    const result = computeObligations(ruleLites, txnLites, asOf, q.horizonDays);
    const all = [...result.arrears, ...result.upcoming, ...result.paid];
    const ruleToDebtAccount = new Map<string, string | undefined>(
      rules.map((r) => [
        String(r._id),
        (r as { debtAccountId?: unknown }).debtAccountId
          ? String((r as { debtAccountId?: unknown }).debtAccountId)
          : undefined,
      ]),
    );
    const calendar = buildEmiCalendar(all, ruleToDebtAccount, asOf);
    return NextResponse.json(calendar, {
      headers: { "Cache-Control": "private, max-age=30" },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
