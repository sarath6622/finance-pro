import { NextResponse, type NextRequest } from "next/server";
import { connectMongo } from "@/lib/db/mongo";
import { requireSession } from "@/lib/auth/session";
import { conflict, errorResponse, notFound } from "@/lib/http/errors";
import { AccountModel, TransactionModel } from "@/models";
import { buildTransferLegs, transferInput } from "@/lib/transactions";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const body = await req.json();
    const input = transferInput.parse(body);
    await connectMongo();

    const [from, to] = await Promise.all([
      AccountModel.findById(input.fromAccountId).lean(),
      AccountModel.findById(input.toAccountId).lean(),
    ]);
    if (!from || !to) throw notFound("From/to account not found");
    if (!from.isActive || !to.isActive) throw conflict("Cannot transfer with archived accounts");

    const nowIso = new Date().toISOString();
    const { legA, legB } = buildTransferLegs(input, nowIso);

    const inserted = await TransactionModel.insertMany(
      [
        { ...legA, bookedAt: new Date(legA.bookedAt), isDeleted: false, editHistory: [] },
        { ...legB, bookedAt: new Date(legB.bookedAt), isDeleted: false, editHistory: [] },
      ],
      { ordered: true },
    );
    const [docA, docB] = inserted;
    if (docA && docB) {
      await TransactionModel.findByIdAndUpdate(docB._id, {
        $set: { reimbursesTransactionId: docA._id },
      });
    }
    return NextResponse.json(
      { legA: docA?.toObject(), legB: docB?.toObject() },
      { status: 201 },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
