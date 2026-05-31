import { NextResponse, type NextRequest } from "next/server";
import { connectMongo } from "@/lib/db/mongo";
import { requireSession } from "@/lib/auth/session";
import { errorResponse, notFound } from "@/lib/http/errors";
import { ReceivableModel, TransactionModel } from "@/models";
import {
  ageBucket,
  computeOutstanding,
  type ReceivableLite,
  type RepaymentLite,
} from "@/lib/receivables";

export const dynamic = "force-dynamic";

function todayIst(): string {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireSession();
    const includeDeleted =
      req.nextUrl.searchParams.get("includeDeleted") === "true";
    const asOf = req.nextUrl.searchParams.get("asOf") ?? todayIst();
    await connectMongo();
    const doc = await ReceivableModel.findById(params.id).lean();
    if (!doc) throw notFound("Receivable not found");
    if (doc.isDeleted && !includeDeleted) throw notFound("Receivable soft-deleted");

    const repDocs = await TransactionModel.find(
      {
        receivableId: doc._id,
        isDeleted: false,
        flowType: { $in: ["lending_repaid", "reimbursement_in"] },
      },
      { _id: 1, valueDate: 1, amountPaise: 1, flowType: 1, description: 1, bookedAt: 1, accountId: 1 },
    )
      .sort({ valueDate: 1, _id: 1 })
      .lean();

    const lite: ReceivableLite = {
      _id: String(doc._id),
      counterpartyId: String(doc.counterpartyId),
      kind: doc.kind as ReceivableLite["kind"],
      principalPaise: doc.principalPaise,
      dateIncurred: doc.dateIncurred,
      accountId: doc.accountId ? String(doc.accountId) : undefined,
      dueModel: (doc.dueModel ?? "none") as ReceivableLite["dueModel"],
      status: doc.status as ReceivableLite["status"],
      repaymentTxnIds: (doc.repaymentTxnIds ?? []).map(String),
      ...(doc.expectedReturnDate ? { expectedReturnDate: doc.expectedReturnDate } : {}),
    };
    const reps: RepaymentLite[] = repDocs.map((r) => ({
      _id: String(r._id),
      receivableId: lite._id,
      valueDate: r.valueDate,
      amountPaise: r.amountPaise,
      isDeleted: false,
      flowType: r.flowType as RepaymentLite["flowType"],
    }));
    const { outstandingPaise, overpaymentPaise } = computeOutstanding(lite, reps);
    return NextResponse.json({
      asOf,
      receivable: {
        ...lite,
        principalPaise: lite.principalPaise,
        outstandingPaise,
        overpaymentPaise,
        ageBucket: ageBucket(lite.dateIncurred, asOf, lite.dueModel),
        closedAt: doc.closedAt ?? undefined,
        notes: doc.notes,
        reminderOptIn: doc.reminderOptIn ?? false,
      },
      repayments: repDocs.map((r) => ({
        _id: String(r._id),
        valueDate: r.valueDate,
        amountPaise: r.amountPaise,
        flowType: r.flowType,
        description: r.description,
        accountId: r.accountId ? String(r.accountId) : undefined,
      })),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
