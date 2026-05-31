import { NextResponse, type NextRequest } from "next/server";
import { connectMongo } from "@/lib/db/mongo";
import { requireSession } from "@/lib/auth/session";
import { conflict, errorResponse, notFound, validation } from "@/lib/http/errors";
import { AccountModel, TransactionModel } from "@/models";
import {
  accountBalanceAt,
  type AccountLite,
  type TxnLite,
} from "@/lib/balances";
import { accountUpdateInput } from "@/lib/schemas/account-input";
import { isValidObjectId } from "mongoose";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireSession();
    if (!isValidObjectId(params.id)) throw notFound("Account not found");
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
      openingDate: account.openingDate ? new Date(account.openingDate).toISOString() : undefined,
      creditLimitPaise: account.creditLimitPaise,
      statementDay: account.statementDay,
      dueDay: account.dueDay,
      interestRatePA: account.interestRatePA,
      tenureMonths: account.tenureMonths,
      emiAmountPaise: account.emiAmountPaise,
      isActive: account.isActive ?? true,
      archivedAt: account.archivedAt ? new Date(account.archivedAt).toISOString() : undefined,
      transactionCount: txns.length,
      balancePaise: balance.ownerPerspectivePaise,
    });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireSession();
    if (!isValidObjectId(params.id)) throw notFound("Account not found");
    const body = await req.json();
    const input = accountUpdateInput.parse(body);
    await connectMongo();

    const account = await AccountModel.findById(params.id);
    if (!account) throw notFound("Account not found");

    if (input.name && input.name !== account.name) {
      const dupe = await AccountModel.findOne({
        name: input.name,
        _id: { $ne: account._id },
      }).lean();
      if (dupe) throw conflict(`Account "${input.name}" already exists`);
    }

    const wantsOpeningChange =
      input.openingBalancePaise !== undefined &&
      input.openingBalancePaise !== account.openingBalancePaise;

    if (wantsOpeningChange) {
      const live = await TransactionModel.countDocuments({
        accountId: account._id,
        isDeleted: false,
      });
      if (live > 0 && !input.acceptOpeningBalanceCascade) {
        throw conflict(
          `Account has ${live} live transaction${live === 1 ? "" : "s"} — editing the opening balance will shift every downstream balance. Re-submit with acceptOpeningBalanceCascade: true to confirm.`,
        );
      }
    }

    const patch: Record<string, unknown> = { ...input };
    delete patch.acceptOpeningBalanceCascade;
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) continue;
      (account as unknown as Record<string, unknown>)[k] = v;
    }
    account.version = (account.version ?? 0) + 1;
    account.bookedAt = new Date();
    await account.save();

    return NextResponse.json({ _id: String(account._id) });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireSession();
    if (!isValidObjectId(params.id)) throw notFound("Account not found");
    const restore = req.nextUrl.searchParams.get("restore") === "1";
    await connectMongo();

    const account = await AccountModel.findById(params.id);
    if (!account) throw notFound("Account not found");

    if (restore) {
      account.isActive = true;
      account.archivedAt = undefined;
    } else {
      if (account.isActive === false) throw conflict("Account is already archived");
      const live = await TransactionModel.countDocuments({
        accountId: account._id,
        isDeleted: false,
      });
      if (live > 0) {
        throw validation(
          `Cannot archive — ${live} live transaction${live === 1 ? "" : "s"} reference this account. Soft-delete them first or move them to another account.`,
        );
      }
      account.isActive = false;
      account.archivedAt = new Date();
    }
    account.version = (account.version ?? 0) + 1;
    account.bookedAt = new Date();
    await account.save();
    return NextResponse.json({ _id: String(account._id), isActive: account.isActive });
  } catch (e) {
    return errorResponse(e);
  }
}
