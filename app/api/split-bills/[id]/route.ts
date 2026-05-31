import { NextResponse, type NextRequest } from "next/server";
import { connectMongo } from "@/lib/db/mongo";
import { requireSession } from "@/lib/auth/session";
import { errorResponse, notFound } from "@/lib/http/errors";
import {
  ReceivableModel,
  SplitBillModel,
  TransactionModel,
} from "@/models";
import { computeOutstanding } from "@/lib/receivables/apply-repayment";
import type { ReceivableLite, RepaymentLite } from "@/lib/receivables/types";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireSession();
    await connectMongo();
    const bill = await SplitBillModel.findById(params.id).lean();
    if (!bill) throw notFound("SplitBill not found");

    const recIds = (bill.participants ?? [])
      .map((p) => p.receivableId)
      .filter((x): x is NonNullable<typeof x> => !!x);
    const recDocs = recIds.length
      ? await ReceivableModel.find({ _id: { $in: recIds } }).lean()
      : [];
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
    const recById = new Map<string, ReceivableLite & { outstandingPaise: number }>();
    for (const d of recDocs) {
      const lite: ReceivableLite = {
        _id: String(d._id),
        counterpartyId: String(d.counterpartyId),
        kind: d.kind as ReceivableLite["kind"],
        principalPaise: d.principalPaise,
        dateIncurred: d.dateIncurred,
        accountId: d.accountId ? String(d.accountId) : undefined,
        dueModel: (d.dueModel ?? "none") as ReceivableLite["dueModel"],
        status: d.status as ReceivableLite["status"],
        repaymentTxnIds: (d.repaymentTxnIds ?? []).map(String),
      };
      const reps = repsByRec.get(lite._id) ?? [];
      const computed = computeOutstanding(lite, reps);
      // written_off receivables are settled from the bill's perspective —
      // the owner already absorbed them as compensating spend.
      const outstandingPaise =
        lite.status === "written_off" ? 0 : computed.outstandingPaise;
      recById.set(lite._id, { ...lite, outstandingPaise });
    }

    return NextResponse.json({
      _id: String(bill._id),
      sourceTransactionId: String(bill.sourceTransactionId),
      totalPaise: bill.totalPaise,
      payerAccountId: String(bill.payerAccountId),
      categoryId: bill.categoryId ? String(bill.categoryId) : undefined,
      ownSharePaise: bill.ownSharePaise,
      status: bill.status,
      notes: bill.notes,
      createdAt: bill.createdAt,
      participants: (bill.participants ?? []).map((p) => {
        const recId = p.receivableId ? String(p.receivableId) : undefined;
        const rec = recId ? recById.get(recId) : undefined;
        return {
          counterpartyId: String(p.counterpartyId),
          sharePaise: p.sharePaise,
          settledPaise: p.settledPaise,
          status: p.status,
          dueModel: p.dueModel,
          receivableId: recId,
          receivableStatus: rec?.status,
          outstandingPaise: rec?.outstandingPaise ?? p.sharePaise - p.settledPaise,
        };
      }),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
