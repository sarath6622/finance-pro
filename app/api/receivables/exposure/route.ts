import { NextResponse, type NextRequest } from "next/server";
import { connectMongo } from "@/lib/db/mongo";
import { requireSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http/errors";
import { ReceivableModel, TransactionModel } from "@/models";
import {
  summarizeExposure,
  type ReceivableLite,
  type RepaymentLite,
} from "@/lib/receivables";
import { exposureQuery } from "@/lib/receivables/validate";

export const dynamic = "force-dynamic";

function todayIst(): string {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const sp = req.nextUrl.searchParams;
    const q = exposureQuery.parse({
      asOf: sp.get("asOf") ?? undefined,
      includeWrittenOff: sp.get("includeWrittenOff") ?? undefined,
    });
    const asOf = q.asOf ?? todayIst();
    await connectMongo();
    const filter: Record<string, unknown> = { isDeleted: { $ne: true } };
    if (!q.includeWrittenOff) filter.status = { $ne: "written_off" };
    const recDocs = await ReceivableModel.find(filter).lean();
    const recIds = recDocs.map((d) => d._id);
    const repDocs = recIds.length
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
    for (const r of repDocs) {
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
    const receivables: ReceivableLite[] = recDocs.map((d) => ({
      _id: String(d._id),
      counterpartyId: String(d.counterpartyId),
      kind: d.kind as ReceivableLite["kind"],
      principalPaise: d.principalPaise,
      dateIncurred: d.dateIncurred,
      accountId: d.accountId ? String(d.accountId) : undefined,
      dueModel: (d.dueModel ?? "none") as ReceivableLite["dueModel"],
      status: d.status as ReceivableLite["status"],
      repaymentTxnIds: (d.repaymentTxnIds ?? []).map(String),
      ...(d.expectedReturnDate ? { expectedReturnDate: d.expectedReturnDate } : {}),
    }));
    const result = summarizeExposure(receivables, repsByRec, asOf);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, max-age=30" },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
