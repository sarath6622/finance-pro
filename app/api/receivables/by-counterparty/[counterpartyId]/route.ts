import { NextResponse, type NextRequest } from "next/server";
import { connectMongo } from "@/lib/db/mongo";
import { requireSession } from "@/lib/auth/session";
import { errorResponse, notFound } from "@/lib/http/errors";
import { CounterpartyModel, ReceivableModel, TransactionModel } from "@/models";
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

export async function GET(
  req: NextRequest,
  { params }: { params: { counterpartyId: string } },
) {
  try {
    await requireSession();
    const asOf = req.nextUrl.searchParams.get("asOf") ?? todayIst();
    await connectMongo();
    const cp = await CounterpartyModel.findById(params.counterpartyId).lean();
    if (!cp) throw notFound("Counterparty not found");
    const recDocs = await ReceivableModel.find({
      counterpartyId: cp._id,
      isDeleted: { $ne: true },
    })
      .sort({ dateIncurred: -1 })
      .lean();
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

    let totalOutstandingPaise = 0;
    let hasPayWhenAble = false;
    const bucketCounts = { "0-30": 0, "30-90": 0, "90+": 0, "pay-when-able": 0 };
    const openOrPartial: ReturnType<typeof toApi>[] = [];
    const closed: ReturnType<typeof toApi>[] = [];
    const writtenOff: ReturnType<typeof toApi>[] = [];

    function toApi(d: Record<string, unknown>) {
      const lite: ReceivableLite = {
        _id: String(d._id),
        counterpartyId: String(d.counterpartyId),
        kind: d.kind as ReceivableLite["kind"],
        principalPaise: d.principalPaise as number,
        dateIncurred: d.dateIncurred as string,
        accountId: d.accountId ? String(d.accountId) : undefined,
        dueModel: ((d.dueModel ?? "none") as ReceivableLite["dueModel"]),
        status: d.status as ReceivableLite["status"],
        repaymentTxnIds: ((d.repaymentTxnIds as unknown[]) ?? []).map(String),
      };
      const reps = repsByRec.get(lite._id) ?? [];
      const { outstandingPaise, overpaymentPaise } = computeOutstanding(lite, reps);
      const bucket = ageBucket(lite.dateIncurred, asOf, lite.dueModel);
      return {
        ...lite,
        outstandingPaise,
        overpaymentPaise,
        ageBucket: bucket,
        closedAt: d.closedAt ? new Date(d.closedAt as Date).toISOString() : undefined,
        notes: d.notes,
      };
    }

    for (const d of recDocs) {
      const api = toApi(d as Record<string, unknown>);
      if (api.status === "written_off") {
        writtenOff.push(api);
        continue;
      }
      if (api.status === "closed") {
        closed.push(api);
        continue;
      }
      openOrPartial.push(api);
      totalOutstandingPaise += api.outstandingPaise;
      bucketCounts[api.ageBucket]++;
      if (api.ageBucket === "pay-when-able") hasPayWhenAble = true;
    }

    return NextResponse.json({
      asOf,
      counterparty: {
        _id: String(cp._id),
        displayName: cp.displayName,
        type: cp.type,
      },
      totalOutstandingPaise,
      hasPayWhenAble,
      bucketCounts,
      openOrPartial,
      closed,
      writtenOff,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
