import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { connectMongo } from "@/lib/db/mongo";
import { requireSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http/errors";
import {
  AccountModel,
  RecurringRuleModel,
  SettingModel,
  TransactionModel,
} from "@/models";
import { forecast, lendSafetyCheck } from "@/lib/projection/liquidity";
import {
  buildScheduledFlows,
  nextPaydayFrom,
  totalLiquidPaiseAt,
} from "@/lib/liquidity/assemble";
import type { RuleLite } from "@/lib/recurring";
import type { TxnLite } from "@/lib/balances/types";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  amountPaise: z.coerce.number().int().min(1),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD")
    .optional(),
});

function todayIst(): string {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const sp = req.nextUrl.searchParams;
    const q = querySchema.parse({
      amountPaise: sp.get("amountPaise") ?? undefined,
      date: sp.get("date") ?? undefined,
    });
    const asOf = todayIst();
    const proposedDate = q.date ?? asOf;
    await connectMongo();

    const setting = await SettingModel.findOne({ key: "default" }).lean();
    const floorPaise = setting?.liquidityFloorPaise ?? 5000000;
    const payday = setting?.paydayDayOfMonth ?? 5;
    const horizonEnd = addDays(nextPaydayFrom(asOf, payday), 1);

    const [accounts, rules, txnsAll] = await Promise.all([
      AccountModel.find({ isActive: true }).lean(),
      RecurringRuleModel.find({ status: { $in: ["active", "paused"] } }).lean(),
      TransactionModel.find(
        { isDeleted: false, valueDate: { $lte: horizonEnd } },
        {
          _id: 1,
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
    const accountsLite = accounts.map((a) => ({
      _id: String(a._id),
      name: a.name,
      kind: a.kind,
      classification: a.classification as "asset" | "liability",
      openingBalancePaise: a.openingBalancePaise,
      ...(a.openingDate ? { openingDate: a.openingDate.toString() } : {}),
    }));
    const lite: TxnLite[] = txnsAll.map((t) => ({
      _id: String(t._id),
      accountId: String(t.accountId),
      valueDate: t.valueDate,
      flowType: t.flowType as TxnLite["flowType"],
      direction: t.direction as TxnLite["direction"],
      amountPaise: t.amountPaise,
      isDeleted: false,
      ...(t.recurringRuleId ? { recurringRuleId: String(t.recurringRuleId) } : {}),
    }));
    const liquid = totalLiquidPaiseAt({
      accounts: accountsLite,
      transactions: lite,
      asOf,
    });
    const ruleLites: RuleLite[] = rules.map((r) => ({
      _id: String(r._id),
      label: r.label,
      accountId: String(r.accountId),
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
    const baseline = forecast({
      asOf,
      horizonEnd,
      currentLiquidPaise: liquid.totalPaise,
      floorPaise,
      flows: buildScheduledFlows({
        asOf,
        horizonEnd,
        rules: ruleLites,
        ruleTxns: lite.filter((t) => !!t.recurringRuleId),
        bookedFutureTxns: lite.filter(
          (t) => !t.recurringRuleId && t.valueDate > asOf,
        ),
      }),
    });
    const result = lendSafetyCheck({
      baseline,
      date: proposedDate,
      amountPaise: q.amountPaise,
    });
    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
