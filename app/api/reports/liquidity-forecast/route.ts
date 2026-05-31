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
import { forecast } from "@/lib/projection/liquidity";
import {
  buildScheduledFlows,
  nextPaydayFrom,
  totalLiquidPaiseAt,
} from "@/lib/liquidity/assemble";
import type { RuleLite } from "@/lib/recurring";
import type { TxnLite } from "@/lib/balances/types";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  asOf: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "asOf must be YYYY-MM-DD")
    .optional(),
  horizonDays: z.coerce.number().int().min(1).max(120).optional(),
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
      asOf: sp.get("asOf") ?? undefined,
      horizonDays: sp.get("horizonDays") ?? undefined,
    });
    const asOf = q.asOf ?? todayIst();
    await connectMongo();

    const setting = await SettingModel.findOne({ key: "default" }).lean();
    const floorPaise = setting?.liquidityFloorPaise ?? 5000000;
    const payday = setting?.paydayDayOfMonth ?? 5;

    // Horizon: explicit override → that many days; else extend to next payday + 1 day,
    // so the forecast includes the salary credit and shows the cycle's low point.
    const horizonEnd = q.horizonDays
      ? addDays(asOf, q.horizonDays)
      : addDays(nextPaydayFrom(asOf, payday), 1);

    const [accounts, rules, txnsAll] = await Promise.all([
      AccountModel.find({ isActive: true }).lean(),
      RecurringRuleModel.find({ status: { $in: ["active", "paused"] } }).lean(),
      TransactionModel.find(
        {
          isDeleted: false,
          valueDate: { $lte: horizonEnd },
        },
        {
          _id: 1,
          accountId: 1,
          valueDate: 1,
          flowType: 1,
          direction: 1,
          amountPaise: 1,
          isDeleted: 1,
          recurringRuleId: 1,
          parentTransactionId: 1,
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
    const allTxns: TxnLite[] = txnsAll.map((t) => ({
      _id: String(t._id),
      accountId: String(t.accountId),
      valueDate: t.valueDate,
      flowType: t.flowType as TxnLite["flowType"],
      direction: t.direction as TxnLite["direction"],
      amountPaise: t.amountPaise,
      isDeleted: false,
      ...(t.parentTransactionId
        ? { parentTransactionId: String(t.parentTransactionId) }
        : {}),
      ...(t.recurringRuleId ? { recurringRuleId: String(t.recurringRuleId) } : {}),
    }));
    const liquid = totalLiquidPaiseAt({
      accounts: accountsLite,
      transactions: allTxns,
      asOf,
    });

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
    const ruleTxns = allTxns.filter((t) => !!t.recurringRuleId);
    const bookedFutureTxns = allTxns.filter(
      (t) => !t.recurringRuleId && t.valueDate > asOf,
    );

    const flows = buildScheduledFlows({
      asOf,
      horizonEnd,
      rules: ruleLites,
      ruleTxns,
      bookedFutureTxns,
    });

    const result = forecast({
      asOf,
      horizonEnd,
      currentLiquidPaise: liquid.totalPaise,
      floorPaise,
      flows,
    });
    return NextResponse.json(
      {
        ...result,
        flows,
        liquidPerAccount: liquid.perAccount,
        floorPaise,
        nextPayday: nextPaydayFrom(asOf, payday),
      },
      { headers: { "Cache-Control": "private, max-age=30" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
