import { NextResponse, type NextRequest } from "next/server";
import { connectMongo } from "@/lib/db/mongo";
import { requireSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http/errors";
import { ReceivableModel, SplitBillModel, TransactionModel } from "@/models";
import { buildR15 } from "@/lib/reports/splits";
import type { ReceivableLite, RepaymentLite } from "@/lib/receivables/types";
import type { SplitBillLite } from "@/lib/splits/types";

export const dynamic = "force-dynamic";

function todayIst(): string {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

const TURF_DESC = /\bturf\b/i;

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const sp = req.nextUrl.searchParams;
    const asOf = sp.get("asOf") ?? todayIst();
    await connectMongo();

    const billDocs = await SplitBillModel.find({ isDeleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    const recIds = new Set<string>();
    const billsLite: SplitBillLite[] = billDocs.map((d) => {
      const participants = (d.participants ?? []).map((p) => {
        if (p.receivableId) recIds.add(String(p.receivableId));
        return {
          counterpartyId: String(p.counterpartyId),
          sharePaise: p.sharePaise,
          settledPaise: p.settledPaise,
          status: p.status,
          dueModel: p.dueModel,
          receivableId: p.receivableId ? String(p.receivableId) : undefined,
        };
      });
      return {
        _id: String(d._id),
        sourceTransactionId: String(d.sourceTransactionId),
        totalPaise: d.totalPaise,
        payerAccountId: String(d.payerAccountId),
        categoryId: d.categoryId ? String(d.categoryId) : undefined,
        participants,
        ownSharePaise: d.ownSharePaise,
        status: d.status,
        isDeleted: !!d.isDeleted,
        createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : undefined,
        notes: d.notes ?? undefined,
      };
    });

    const recDocs = recIds.size
      ? await ReceivableModel.find({ _id: { $in: [...recIds] } }).lean()
      : [];
    const recs: ReceivableLite[] = recDocs.map((d) => ({
      _id: String(d._id),
      counterpartyId: String(d.counterpartyId),
      kind: d.kind as ReceivableLite["kind"],
      principalPaise: d.principalPaise,
      dateIncurred: d.dateIncurred,
      accountId: d.accountId ? String(d.accountId) : undefined,
      dueModel: (d.dueModel ?? "none") as ReceivableLite["dueModel"],
      status: d.status as ReceivableLite["status"],
      repaymentTxnIds: (d.repaymentTxnIds ?? []).map(String),
    }));
    const repDocs = recIds.size
      ? await TransactionModel.find(
          {
            receivableId: { $in: [...recIds] },
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

    // Look up source-txn descriptions once so we can mark turf bills.
    const sourceTxnIds = billsLite.map((b) => b.sourceTransactionId);
    const sourceTxns = sourceTxnIds.length
      ? await TransactionModel.find(
          { _id: { $in: sourceTxnIds } },
          { _id: 1, description: 1 },
        ).lean()
      : [];
    const descById = new Map(
      sourceTxns.map((t) => [String(t._id), (t.description ?? "") as string]),
    );

    const out = buildR15(billsLite, recs, repsByRec, asOf, (b) => {
      const desc = descById.get(b.sourceTransactionId) ?? "";
      return TURF_DESC.test(desc);
    });
    return NextResponse.json(out, {
      headers: { "Cache-Control": "private, max-age=30" },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
