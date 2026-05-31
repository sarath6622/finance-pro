import { NextResponse, type NextRequest } from "next/server";
import { connectMongo } from "@/lib/db/mongo";
import { requireSession } from "@/lib/auth/session";
import { conflict, errorResponse, notFound, validation } from "@/lib/http/errors";
import {
  CounterpartyModel,
  TransactionModel,
  ReceivableModel,
} from "@/models";
import { counterpartyUpdateInput } from "@/lib/schemas/counterparty-input";
import { isValidObjectId } from "mongoose";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireSession();
    if (!isValidObjectId(params.id)) throw notFound("Counterparty not found");
    const body = await req.json();
    const input = counterpartyUpdateInput.parse(body);
    await connectMongo();

    const cp = await CounterpartyModel.findById(params.id);
    if (!cp) throw notFound("Counterparty not found");

    if (input.displayName && input.type) {
      const dupe = await CounterpartyModel.findOne({
        displayName: input.displayName,
        type: input.type,
        _id: { $ne: cp._id },
      }).lean();
      if (dupe) throw conflict(`Counterparty "${input.displayName}" (${input.type}) already exists`);
    }

    for (const [k, v] of Object.entries(input)) {
      if (v === undefined) continue;
      (cp as unknown as Record<string, unknown>)[k] = v;
    }
    cp.version = (cp.version ?? 0) + 1;
    cp.bookedAt = new Date();
    await cp.save();

    return NextResponse.json({ _id: String(cp._id) });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireSession();
    if (!isValidObjectId(params.id)) throw notFound("Counterparty not found");
    const restore = req.nextUrl.searchParams.get("restore") === "1";
    await connectMongo();

    const cp = await CounterpartyModel.findById(params.id);
    if (!cp) throw notFound("Counterparty not found");

    if (restore) {
      cp.isActive = true;
      cp.archivedAt = undefined;
    } else {
      if (cp.isActive === false) throw conflict("Counterparty is already archived");
      const [liveTxns, openReceivables] = await Promise.all([
        TransactionModel.countDocuments({
          counterpartyId: cp._id,
          isDeleted: false,
        }),
        ReceivableModel.countDocuments({
          counterpartyId: cp._id,
          status: { $in: ["open", "partial"] },
          isDeleted: false,
        }),
      ]);
      if (liveTxns > 0 || openReceivables > 0) {
        const parts = [];
        if (liveTxns > 0) parts.push(`${liveTxns} live transaction${liveTxns === 1 ? "" : "s"}`);
        if (openReceivables > 0)
          parts.push(`${openReceivables} open receivable${openReceivables === 1 ? "" : "s"}`);
        throw validation(
          `Cannot archive — ${parts.join(" and ")} reference this counterparty. Settle or reassign first.`,
        );
      }
      cp.isActive = false;
      cp.archivedAt = new Date();
    }
    cp.version = (cp.version ?? 0) + 1;
    cp.bookedAt = new Date();
    await cp.save();
    return NextResponse.json({ _id: String(cp._id), isActive: cp.isActive });
  } catch (e) {
    return errorResponse(e);
  }
}
