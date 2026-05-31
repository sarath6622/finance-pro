import { NextResponse, type NextRequest } from "next/server";
import { connectMongo } from "@/lib/db/mongo";
import { requireSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http/errors";
import { SettingModel, TransactionModel } from "@/models";
import { burnDown } from "@/lib/projection/liquidity";
import { nextPaydayFrom, priorPaydayFrom } from "@/lib/liquidity/assemble";

export const dynamic = "force-dynamic";

function todayIst(): string {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

function dayBefore(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const sp = req.nextUrl.searchParams;
    const asOf = sp.get("asOf") ?? todayIst();
    await connectMongo();

    const setting = await SettingModel.findOne({ key: "default" }).lean();
    const payday = setting?.paydayDayOfMonth ?? 5;
    const cycleStart = priorPaydayFrom(asOf, payday);
    const cycleEnd = dayBefore(nextPaydayFrom(cycleStart, payday));

    const txns = await TransactionModel.find(
      {
        isDeleted: false,
        valueDate: { $gte: cycleStart, $lte: cycleEnd },
      },
      {
        _id: 1,
        accountId: 1,
        valueDate: 1,
        flowType: 1,
        direction: 1,
        amountPaise: 1,
      },
    ).lean();

    let paydayInflow = 0;
    const flows: Parameters<typeof burnDown>[0]["flows"] = [];
    for (const t of txns) {
      const date = t.valueDate;
      if (t.flowType === "income" && t.direction === "in" && date === cycleStart) {
        // The first salary credit on payday is the burn-down seed.
        paydayInflow += t.amountPaise;
        continue;
      }
      if (t.flowType === "transfer" || t.flowType === "card_settlement") continue;
      const signed =
        t.direction === "in" ? t.amountPaise : -t.amountPaise;
      flows.push({ date, signedPaise: signed, label: t.flowType });
    }

    const report = burnDown(
      {
        cycleStart,
        cycleEnd,
        paydayInflowPaise: paydayInflow,
        flows,
      },
      asOf,
    );
    return NextResponse.json({ ...report, asOf });
  } catch (e) {
    return errorResponse(e);
  }
}
