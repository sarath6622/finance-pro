import { NextResponse } from "next/server";
import { connectMongo } from "@/lib/db/mongo";
import { requireSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http/errors";
import { AccountModel, TransactionModel } from "@/models";
import { allAccountBalances, type AccountLite, type TxnLite } from "@/lib/balances";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireSession();
    await connectMongo();
    const [accountsDocs, txnDocs] = await Promise.all([
      AccountModel.find({ isActive: true }).lean(),
      TransactionModel.find({ isDeleted: false }, {
        accountId: 1,
        valueDate: 1,
        flowType: 1,
        direction: 1,
        amountPaise: 1,
        isDeleted: 1,
        parentTransactionId: 1,
      }).lean(),
    ]);
    const accounts: AccountLite[] = accountsDocs.map((a) => ({
      _id: String(a._id),
      classification: a.classification as AccountLite["classification"],
      openingBalancePaise: a.openingBalancePaise,
      ...(a.openingDate ? { openingDate: new Date(a.openingDate).toISOString() } : {}),
    }));
    const transactions: TxnLite[] = txnDocs.map((t) => ({
      _id: String(t._id),
      accountId: String(t.accountId),
      valueDate: t.valueDate,
      flowType: t.flowType as TxnLite["flowType"],
      direction: t.direction as TxnLite["direction"],
      amountPaise: t.amountPaise,
      isDeleted: t.isDeleted ?? false,
      ...(t.parentTransactionId ? { parentTransactionId: String(t.parentTransactionId) } : {}),
    }));
    const balances = allAccountBalances({ transactions, accounts });
    const byId = new Map(balances.map((b) => [b.accountId, b]));
    const items = accountsDocs.map((a) => ({
      _id: String(a._id),
      name: a.name,
      kind: a.kind,
      classification: a.classification,
      institution: a.institution,
      last4Label: a.last4Label,
      openingBalancePaise: a.openingBalancePaise,
      balancePaise: byId.get(String(a._id))?.ownerPerspectivePaise ?? a.openingBalancePaise,
    }));
    return NextResponse.json({ items });
  } catch (e) {
    return errorResponse(e);
  }
}
