import { NextResponse } from "next/server";
import { connectMongo } from "@/lib/db/mongo";
import { requireSession } from "@/lib/auth/session";
import { errorResponse, notFound } from "@/lib/http/errors";
import { AccountModel, TransactionModel } from "@/models";
import {
  accountBalanceAt,
  type AccountLite,
  type TxnLite,
} from "@/lib/balances";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireSession();
    await connectMongo();
    const account = await AccountModel.findById(params.id).lean();
    if (!account) throw notFound("Account not found");
    const txnDocs = await TransactionModel.find(
      { accountId: account._id, isDeleted: false },
      {
        accountId: 1,
        valueDate: 1,
        flowType: 1,
        direction: 1,
        amountPaise: 1,
        isDeleted: 1,
        parentTransactionId: 1,
      },
    ).lean();
    const accountLite: AccountLite = {
      _id: String(account._id),
      classification: account.classification as AccountLite["classification"],
      openingBalancePaise: account.openingBalancePaise,
      ...(account.openingDate
        ? { openingDate: new Date(account.openingDate).toISOString() }
        : {}),
    };
    const txns: TxnLite[] = txnDocs.map((t) => ({
      _id: String(t._id),
      accountId: String(t.accountId),
      valueDate: t.valueDate,
      flowType: t.flowType as TxnLite["flowType"],
      direction: t.direction as TxnLite["direction"],
      amountPaise: t.amountPaise,
      isDeleted: t.isDeleted ?? false,
      ...(t.parentTransactionId
        ? { parentTransactionId: String(t.parentTransactionId) }
        : {}),
    }));
    const balance = accountBalanceAt(accountLite._id, {
      transactions: txns,
      accounts: [accountLite],
    });
    return NextResponse.json({
      _id: String(account._id),
      name: account.name,
      kind: account.kind,
      classification: account.classification,
      institution: account.institution,
      last4Label: account.last4Label,
      openingBalancePaise: account.openingBalancePaise,
      balancePaise: balance.ownerPerspectivePaise,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
