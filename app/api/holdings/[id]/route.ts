import { NextResponse, type NextRequest } from "next/server";
import { connectMongo } from "@/lib/db/mongo";
import { requireSession } from "@/lib/auth/session";
import { errorResponse, notFound } from "@/lib/http/errors";
import { HoldingModel, TransactionModel } from "@/models";
import { getHoldingLite, softDeleteHolding } from "@/lib/holdings/lifecycle";
import { valueAt } from "@/lib/holdings/valuation";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireSession();
    await connectMongo();
    const h = await getHoldingLite(params.id);
    if (!h) throw notFound("Holding not found");
    const doc = await HoldingModel.findById(params.id).lean();
    const valuation = valueAt(h);
    // Pull related buy/sell transactions for the audit-trail panel.
    const txns = await TransactionModel.find(
      { holdingId: params.id, isDeleted: false },
      {
        _id: 1,
        valueDate: 1,
        flowType: 1,
        direction: 1,
        amountPaise: 1,
        accountId: 1,
        description: 1,
      },
    )
      .sort({ valueDate: -1, _id: -1 })
      .limit(100)
      .lean();
    return NextResponse.json({
      holding: h,
      valuation,
      corporateActions: (doc as { corporateActions?: unknown[] } | null)?.corporateActions ?? [],
      transactions: txns.map((t) => ({
        _id: String(t._id),
        valueDate: t.valueDate,
        flowType: t.flowType,
        direction: t.direction,
        amountPaise: t.amountPaise,
        accountId: String(t.accountId),
        description: t.description ?? "",
      })),
    });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireSession();
    await connectMongo();
    await softDeleteHolding(params.id);
    return NextResponse.json({ _id: params.id, isDeleted: true });
  } catch (e) {
    return errorResponse(e);
  }
}
