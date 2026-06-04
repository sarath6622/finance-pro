import { NextResponse, type NextRequest } from "next/server";
import { connectMongo } from "@/lib/db/mongo";
import { requireSession } from "@/lib/auth/session";
import {
  ApiError,
  conflict,
  errorResponse,
  notFound,
  validation,
} from "@/lib/http/errors";
import { AccountModel, TransactionModel } from "@/models";
import { buildCardSettlementLegs, cardSettlementInput } from "@/lib/transactions";
import { accountBalanceAt } from "@/lib/balances/compute";
import { cardInFullCheck } from "@/lib/loans/lifecycle";
import type { AccountLite, TxnLite } from "@/lib/balances/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const body = await req.json();
    const input = cardSettlementInput.parse(body);
    await connectMongo();

    const [from, card] = await Promise.all([
      AccountModel.findById(input.fromAccountId).lean(),
      AccountModel.findById(input.toCardAccountId).lean(),
    ]);
    if (!from || !card) throw notFound("From/to account not found");
    if (!from.isActive || !card.isActive) {
      throw conflict("Cannot settle with archived accounts");
    }
    if (card.kind !== "credit_card") {
      throw validation("toCardAccountId must be a credit_card account");
    }
    if (from.kind === "credit_card") {
      throw validation("fromAccountId cannot be a credit_card account");
    }

    // FR-22 card-in-full guard. Compute the card's *current* statement balance
    // (liability stored as negative ledger; flip sign for "amount owed").
    const cardTxns = await TransactionModel.find(
      { accountId: card._id, isDeleted: false },
      {
        _id: 1,
        accountId: 1,
        valueDate: 1,
        flowType: 1,
        direction: 1,
        amountPaise: 1,
        isDeleted: 1,
        parentTransactionId: 1,
      },
    ).lean();
    const lite: TxnLite[] = cardTxns.map((t) => ({
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
    }));
    const acc: AccountLite = {
      _id: String(card._id),
      classification: card.classification,
      openingBalancePaise: card.openingBalancePaise,
      ...(card.openingDate ? { openingDate: card.openingDate.toString() } : {}),
    };
    const ledger = accountBalanceAt(String(card._id), {
      transactions: lite,
      accounts: [acc],
    }).ownerPerspectivePaise;
    const owed = Math.max(0, -ledger);
    const check = cardInFullCheck(owed, input.amountPaise);
    if (!check.isFull && !input.acceptUnderpayment) {
      throw new ApiError(
        "conflict",
        `Card settlement (${input.amountPaise} paise) is below statement balance (${owed} paise). Pass acceptUnderpayment=true to record anyway.`,
        { shortfallPaise: check.shortfallPaise, cardBalancePaise: owed },
      );
    }

    const nowIso = new Date().toISOString();
    const { legBank, legCard } = buildCardSettlementLegs(input, nowIso);

    const inserted = await TransactionModel.insertMany(
      [
        { ...legBank, bookedAt: new Date(legBank.bookedAt), isDeleted: false, editHistory: [] },
        { ...legCard, bookedAt: new Date(legCard.bookedAt), isDeleted: false, editHistory: [] },
      ],
      { ordered: true },
    );
    const [docBank, docCard] = inserted;
    if (docBank && docCard) {
      await TransactionModel.findByIdAndUpdate(docCard._id, {
        $set: { reimbursesTransactionId: docBank._id },
      });
    }
    return NextResponse.json(
      { legBank: docBank?.toObject(), legCard: docCard?.toObject() },
      { status: 201 },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
