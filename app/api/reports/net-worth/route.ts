import { NextResponse, type NextRequest } from "next/server";
import { connectMongo } from "@/lib/db/mongo";
import { requireSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http/errors";
import {
  AccountModel,
  HoldingModel,
  ReceivableModel,
  TransactionModel,
} from "@/models";
import { buildNetWorth } from "@/lib/reports/net-worth";
import type { TxnLite } from "@/lib/balances/types";
import type { ReceivableLite, RepaymentLite } from "@/lib/receivables/types";
import type { HoldingLite } from "@/lib/holdings/types";

export const dynamic = "force-dynamic";

function todayIst(): string {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const sp = req.nextUrl.searchParams;
    const asOf = sp.get("asOf") ?? todayIst();
    await connectMongo();

    const accDocs = await AccountModel.find({ isActive: true }).lean();
    const txnDocs = await TransactionModel.find(
      { isDeleted: false, valueDate: { $lte: asOf } },
      {
        _id: 1,
        accountId: 1,
        valueDate: 1,
        flowType: 1,
        direction: 1,
        amountPaise: 1,
        isDeleted: 1,
        parentTransactionId: 1,
        debtAccountId: 1,
        interestPortionPaise: 1,
        splitId: 1,
      },
    ).lean();
    const recDocs = await ReceivableModel.find({ isDeleted: { $ne: true } }).lean();
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

    const accounts = accDocs.map((a) => ({
      _id: String(a._id),
      name: a.name,
      kind: a.kind,
      classification: a.classification,
      openingBalancePaise: a.openingBalancePaise,
      ...(a.openingDate ? { openingDate: a.openingDate.toString() } : {}),
      ...(a.interestRatePA !== undefined && a.interestRatePA !== null
        ? { interestRatePA: a.interestRatePA }
        : {}),
      ...(a.emiAmountPaise !== undefined && a.emiAmountPaise !== null
        ? { emiAmountPaise: a.emiAmountPaise }
        : {}),
    }));
    const lite: TxnLite[] = txnDocs.map((t) => ({
      _id: String(t._id),
      accountId: String(t.accountId),
      valueDate: t.valueDate,
      flowType: t.flowType as TxnLite["flowType"],
      direction: t.direction as TxnLite["direction"],
      amountPaise: t.amountPaise,
      isDeleted: false,
      ...(t.parentTransactionId
        ? { parentTransactionId: String(t.parentTransactionId) }
        : {}),
      ...(t.debtAccountId ? { debtAccountId: String(t.debtAccountId) } : {}),
      ...(t.interestPortionPaise !== undefined && t.interestPortionPaise !== null
        ? { interestPortionPaise: t.interestPortionPaise }
        : {}),
    }));
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
    }));
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

    const holdingDocs = await HoldingModel.find({
      isActive: true,
      isDeleted: { $ne: true },
    }).lean();
    const holdings: HoldingLite[] = holdingDocs.map((d) => ({
      _id: String(d._id),
      assetType: d.assetType as HoldingLite["assetType"],
      symbol: d.symbol,
      name: d.name,
      platform: d.platform,
      quantity: d.quantity ?? 0,
      lots: ((d.lots ?? []) as Array<{ date: string; quantity: number; unitCostPaise: number; txnId?: unknown }>).map(
        (l) => ({
          date: l.date,
          quantity: l.quantity,
          unitCostPaise: l.unitCostPaise,
          ...(l.txnId ? { txnId: String(l.txnId) } : {}),
        }),
      ),
      ...(d.currentUnitPricePaise !== undefined && d.currentUnitPricePaise !== null
        ? { currentUnitPricePaise: d.currentUnitPricePaise }
        : {}),
      priceCurrency: (d.priceCurrency ?? "INR") as HoldingLite["priceCurrency"],
      ...(d.fxRateToInr ? { fxRateToInr: d.fxRateToInr } : {}),
      ...(d.priceUpdatedAt
        ? { priceUpdatedAt: new Date(d.priceUpdatedAt).toISOString() }
        : {}),
      priceSource: (d.priceSource ?? "manual") as HoldingLite["priceSource"],
      realizedPnLPaise: d.realizedPnLPaise ?? 0,
      isActive: d.isActive !== false,
    }));

    const report = buildNetWorth({
      asOf,
      accounts,
      transactions: lite,
      receivables,
      holdings,
      repaymentsByReceivable: repsByRec,
    });
    return NextResponse.json(report, {
      headers: { "Cache-Control": "private, max-age=30" },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
