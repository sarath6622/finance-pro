import { NextResponse, type NextRequest } from "next/server";
import { connectMongo } from "@/lib/db/mongo";
import { requireSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http/errors";
import { SplitBillModel } from "@/models";
import { convertSpendToSplitBill } from "@/lib/splits/lifecycle";
import { createSplitBillInput, splitListQuery } from "@/lib/splits/validate";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const sp = req.nextUrl.searchParams;
    const q = splitListQuery.parse({
      status: sp.get("status") ?? undefined,
      counterpartyId: sp.get("counterpartyId") ?? undefined,
    });
    await connectMongo();
    const filter: Record<string, unknown> = { isDeleted: { $ne: true } };
    if (q.status) filter.status = q.status;
    if (q.counterpartyId) filter["participants.counterpartyId"] = q.counterpartyId;
    const docs = await SplitBillModel.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(200)
      .lean();
    return NextResponse.json({
      items: docs.map((d) => ({
        _id: String(d._id),
        sourceTransactionId: String(d.sourceTransactionId),
        totalPaise: d.totalPaise,
        payerAccountId: String(d.payerAccountId),
        categoryId: d.categoryId ? String(d.categoryId) : undefined,
        participants: (d.participants ?? []).map((p) => ({
          counterpartyId: String(p.counterpartyId),
          sharePaise: p.sharePaise,
          settledPaise: p.settledPaise,
          status: p.status,
          dueModel: p.dueModel,
          receivableId: p.receivableId ? String(p.receivableId) : undefined,
        })),
        ownSharePaise: d.ownSharePaise,
        status: d.status,
        notes: d.notes,
        createdAt: d.createdAt,
      })),
    });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const body = createSplitBillInput.parse(await req.json());
    await connectMongo();
    const result = await convertSpendToSplitBill(body);
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
