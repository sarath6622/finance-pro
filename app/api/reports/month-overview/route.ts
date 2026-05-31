import { NextResponse, type NextRequest } from "next/server";
import { connectMongo } from "@/lib/db/mongo";
import { requireSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http/errors";
import { SettingModel, SplitBillModel, TransactionModel } from "@/models";
import { buildPeriod, monthOverview } from "@/lib/reports";
import { periodQuery } from "@/lib/reports/api-input";
import type { TxnLite } from "@/lib/balances/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const sp = req.nextUrl.searchParams;
    const q = periodQuery.parse({
      year: sp.get("year"),
      month: sp.get("month"),
      mode: sp.get("mode") ?? undefined,
      anchorDay: sp.get("anchorDay") ?? undefined,
    });
    await connectMongo();
    const setting = await SettingModel.findOne({ key: "default" }).lean();
    const mode = q.mode ?? (setting?.payCycleMode as "calendar" | "pay_cycle" | undefined) ?? "pay_cycle";
    const anchorDay = q.anchorDay ?? setting?.paydayDayOfMonth ?? 5;
    const period = buildPeriod({ mode, anchorDay, year: q.year, month: q.month });
    const txnDocs = await TransactionModel.find(
      {
        isDeleted: false,
        valueDate: { $gte: period.start, $lte: period.endInclusive },
      },
      {
        accountId: 1,
        valueDate: 1,
        flowType: 1,
        direction: 1,
        amountPaise: 1,
        isDeleted: 1,
        parentTransactionId: 1,
        needWant: 1,
        categoryId: 1,
        splitId: 1,
      },
    ).lean();
    const splitIds = txnDocs
      .map((t) => (t as { splitId?: unknown }).splitId)
      .filter((id): id is NonNullable<typeof id> => !!id);
    const splitBills = splitIds.length
      ? await SplitBillModel.find(
          { _id: { $in: splitIds }, isDeleted: { $ne: true } },
          { ownSharePaise: 1 },
        ).lean()
      : [];
    const ownShareById = new Map<string, number>(
      splitBills.map((b) => [String(b._id), b.ownSharePaise]),
    );
    const parentTxnDocs = await TransactionModel.find(
      {
        isDeleted: false,
        _id: {
          $in: txnDocs
            .map((t) => t.parentTransactionId)
            .filter((id): id is NonNullable<typeof id> => !!id),
        },
      },
      {
        accountId: 1,
        valueDate: 1,
        flowType: 1,
        direction: 1,
        amountPaise: 1,
        isDeleted: 1,
        parentTransactionId: 1,
      },
    ).lean();
    const all: TxnLite[] = [...txnDocs, ...parentTxnDocs].map((t) => {
      const splitId = (t as { splitId?: unknown }).splitId
        ? String((t as { splitId?: unknown }).splitId)
        : undefined;
      const splitOwnSharePaise = splitId ? ownShareById.get(splitId) : undefined;
      return {
        _id: String(t._id),
        accountId: String(t.accountId),
        valueDate: t.valueDate,
        flowType: t.flowType as TxnLite["flowType"],
        direction: t.direction as TxnLite["direction"],
        amountPaise: t.amountPaise,
        isDeleted: t.isDeleted ?? false,
        ...(t.parentTransactionId ? { parentTransactionId: String(t.parentTransactionId) } : {}),
        ...((t as { needWant?: string }).needWant
          ? { needWant: (t as { needWant?: "need" | "want" }).needWant }
          : {}),
        ...(splitId ? { splitId } : {}),
        ...(splitOwnSharePaise !== undefined ? { splitOwnSharePaise } : {}),
      };
    });
    const report = monthOverview({ transactions: all, period });
    return NextResponse.json(report);
  } catch (e) {
    return errorResponse(e);
  }
}
