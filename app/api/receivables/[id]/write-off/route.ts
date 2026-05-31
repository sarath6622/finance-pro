import { NextResponse, type NextRequest } from "next/server";
import { connectMongo } from "@/lib/db/mongo";
import { requireSession } from "@/lib/auth/session";
import { conflict, errorResponse, notFound } from "@/lib/http/errors";
import { CounterpartyModel, ReceivableModel, TransactionModel } from "@/models";
import { writeOff, WriteOffError } from "@/lib/receivables";
import { writeOffInput } from "@/lib/receivables/validate";
import type { ReceivableLite, RepaymentLite } from "@/lib/receivables";

export const dynamic = "force-dynamic";

function todayIst(): string {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireSession();
    const body = await req.json().catch(() => ({}));
    const input = writeOffInput.parse(body);
    await connectMongo();

    const recDoc = await ReceivableModel.findById(params.id).lean();
    if (!recDoc) throw notFound("Receivable not found");
    if (recDoc.isDeleted) throw conflict("Receivable is soft-deleted");

    const repDocs = await TransactionModel.find(
      {
        receivableId: recDoc._id,
        isDeleted: false,
        flowType: { $in: ["lending_repaid", "reimbursement_in"] },
      },
      { _id: 1, valueDate: 1, amountPaise: 1, flowType: 1 },
    ).lean();

    const lite: ReceivableLite = {
      _id: String(recDoc._id),
      counterpartyId: String(recDoc.counterpartyId),
      kind: recDoc.kind as ReceivableLite["kind"],
      principalPaise: recDoc.principalPaise,
      dateIncurred: recDoc.dateIncurred,
      accountId: recDoc.accountId ? String(recDoc.accountId) : undefined,
      dueModel: (recDoc.dueModel ?? "none") as ReceivableLite["dueModel"],
      status: recDoc.status as ReceivableLite["status"],
      repaymentTxnIds: (recDoc.repaymentTxnIds ?? []).map(String),
    };
    const reps: RepaymentLite[] = repDocs.map((r) => ({
      _id: String(r._id),
      receivableId: lite._id,
      valueDate: r.valueDate,
      amountPaise: r.amountPaise,
      isDeleted: false,
      flowType: r.flowType as RepaymentLite["flowType"],
    }));

    // Resolve category fallback: counterparty default if input didn't override
    let categoryId = input.categoryId;
    if (!categoryId) {
      const cp = await CounterpartyModel.findById(recDoc.counterpartyId)
        .select({ defaultCategoryId: 1 })
        .lean();
      if (cp?.defaultCategoryId) categoryId = String(cp.defaultCategoryId);
    }

    const nowIso = new Date().toISOString();
    const asOf = todayIst();
    let draft;
    let next;
    try {
      ({ receivableNext: next, compensatingTxnDraft: draft } = writeOff(
        lite,
        reps,
        asOf,
        nowIso,
        {
          ...(categoryId ? { categoryId } : {}),
          ...(input.notes ? { notes: input.notes } : {}),
        },
      ));
    } catch (e) {
      if (e instanceof WriteOffError) {
        throw conflict(e.code);
      }
      throw e;
    }

    const compensating = await TransactionModel.create({
      ...draft,
      bookedAt: new Date(draft.bookedAt),
      isDeleted: false,
      editHistory: [],
    });

    const updated = await ReceivableModel.findByIdAndUpdate(
      recDoc._id,
      {
        $set: { status: next.status, closedAt: next.closedAt ? new Date(next.closedAt) : undefined },
        $push: {
          editHistory: {
            at: new Date(nowIso),
            field: "status",
            from: lite.status,
            to: next.status,
          },
          repaymentTxnIds: compensating._id,
        },
      },
      { new: true },
    ).lean();

    return NextResponse.json(
      {
        receivable: {
          _id: String(updated?._id ?? recDoc._id),
          status: next.status,
          closedAt: next.closedAt,
        },
        compensatingTransaction: compensating.toObject(),
      },
      { status: 201 },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
