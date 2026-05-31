import { NextResponse, type NextRequest } from "next/server";
import { connectMongo } from "@/lib/db/mongo";
import { requireSession } from "@/lib/auth/session";
import { conflict, errorResponse, notFound, validation } from "@/lib/http/errors";
import { TransactionModel } from "@/models";
import { buildSplitChildren, splitInput, type ParentLike } from "@/lib/transactions";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireSession();
    const body = await req.json();
    const input = splitInput.parse(body);
    await connectMongo();

    const parent = await TransactionModel.findById(params.id).lean();
    if (!parent) throw notFound("Parent transaction not found");
    const liveChildrenCount = await TransactionModel.countDocuments({
      parentTransactionId: parent._id,
      isDeleted: false,
    });

    const parentLike: ParentLike = {
      _id: String(parent._id),
      amountPaise: parent.amountPaise,
      direction: parent.direction as "in" | "out",
      accountId: String(parent.accountId),
      valueDate: parent.valueDate,
      bookedAt: parent.bookedAt ? new Date(parent.bookedAt).toISOString() : new Date().toISOString(),
      ...(parent.receivableId ? { receivableId: String(parent.receivableId) } : {}),
      ...(parent.splitId ? { splitId: String(parent.splitId) } : {}),
      isDeleted: parent.isDeleted ?? false,
    };
    const nowIso = new Date().toISOString();
    const result = buildSplitChildren(parentLike, input.children, liveChildrenCount > 0, nowIso);
    if (result.errors.length > 0) {
      if (result.errors.some((e) => /sum/.test(e))) throw validation(result.errors.join("; "));
      throw conflict(result.errors.join("; "));
    }

    const created = await TransactionModel.insertMany(
      result.children.map((c) => ({
        ...c,
        bookedAt: new Date(c.bookedAt),
        isDeleted: false,
        editHistory: [],
      })),
      { ordered: true },
    );

    return NextResponse.json({ children: created.map((d) => d.toObject()) }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
