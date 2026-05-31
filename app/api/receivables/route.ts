import { NextResponse, type NextRequest } from "next/server";
import { connectMongo } from "@/lib/db/mongo";
import { requireSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http/errors";
import { ReceivableModel, TransactionModel } from "@/models";
import { receivableListQuery } from "@/lib/receivables/validate";
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

function recToLite(doc: Record<string, unknown>): ReceivableLite {
  return {
    _id: String(doc._id),
    counterpartyId: String(doc.counterpartyId),
    kind: doc.kind as ReceivableLite["kind"],
    principalPaise: doc.principalPaise as number,
    dateIncurred: doc.dateIncurred as string,
    accountId: doc.accountId ? String(doc.accountId) : undefined,
    dueModel: (doc.dueModel ?? "none") as ReceivableLite["dueModel"],
    status: doc.status as ReceivableLite["status"],
    repaymentTxnIds: ((doc.repaymentTxnIds as unknown[]) ?? []).map(String),
    ...(doc.splitId ? { splitId: String(doc.splitId) } : {}),
    ...(doc.closedAt ? { closedAt: new Date(doc.closedAt as Date).toISOString() } : {}),
    ...(doc.expectedReturnDate ? { expectedReturnDate: doc.expectedReturnDate as string } : {}),
    isDeleted: !!doc.isDeleted,
  };
}

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const sp = req.nextUrl.searchParams;
    const q = receivableListQuery.parse({
      status: sp.get("status") ?? undefined,
      counterpartyId: sp.get("counterpartyId") ?? undefined,
      kind: sp.get("kind") ?? undefined,
      includeWrittenOff: sp.get("includeWrittenOff") ?? undefined,
      asOf: sp.get("asOf") ?? undefined,
    });
    const asOf = q.asOf ?? todayIst();
    await connectMongo();

    const filter: Record<string, unknown> = { isDeleted: { $ne: true } };
    if (q.status) filter.status = q.status;
    if (q.counterpartyId) filter.counterpartyId = q.counterpartyId;
    if (q.kind) filter.kind = q.kind;
    if (!q.includeWrittenOff && !q.status) filter.status = { $ne: "written_off" };

    const recDocs = await ReceivableModel.find(filter)
      .sort({ dateIncurred: -1, _id: -1 })
      .limit(200)
      .lean();
    const recIds = recDocs.map((d) => d._id);
    const repaymentDocs = recIds.length
      ? await TransactionModel.find(
          {
            receivableId: { $in: recIds },
            isDeleted: false,
            flowType: { $in: ["lending_repaid", "reimbursement_in"] },
          },
          { _id: 1, receivableId: 1, valueDate: 1, amountPaise: 1, flowType: 1 },
        ).lean()
      : [];

    const repsByRec = new Map<string, RepaymentLite[]>();
    for (const r of repaymentDocs) {
      const key = String(r.receivableId);
      const list = repsByRec.get(key) ?? [];
      list.push({
        _id: String(r._id),
        receivableId: key,
        valueDate: r.valueDate,
        amountPaise: r.amountPaise,
        isDeleted: false,
        flowType: r.flowType as RepaymentLite["flowType"],
      });
      repsByRec.set(key, list);
    }

    const items = recDocs.map((doc) => {
      const lite = recToLite(doc as Record<string, unknown>);
      const reps = repsByRec.get(lite._id) ?? [];
      const { outstandingPaise, overpaymentPaise } = computeOutstanding(lite, reps);
      return {
        ...lite,
        outstandingPaise,
        overpaymentPaise,
        ageBucket: ageBucket(lite.dateIncurred, asOf, lite.dueModel),
        principalPaise: lite.principalPaise,
      };
    });
    return NextResponse.json({ asOf, items });
  } catch (e) {
    return errorResponse(e);
  }
}
