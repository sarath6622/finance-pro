import { NextResponse, type NextRequest } from "next/server";
import { connectMongo } from "@/lib/db/mongo";
import { requireSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http/errors";
import { AccountModel, ReceivableModel, TransactionModel } from "@/models";
import { listFilters, transactionCreateInput } from "@/lib/transactions";
import {
  applyRepaymentToReceivable,
  createLendingOutWithReceivable,
} from "@/lib/receivables/lifecycle";
import { recomputeBillStatus } from "@/lib/splits/lifecycle";
import { cardInFullCheck, createDebtRepayment } from "@/lib/loans/lifecycle";
import { accountBalanceAt } from "@/lib/balances/compute";
import type { AccountLite, TxnLite } from "@/lib/balances/types";
import { ApiError } from "@/lib/http/errors";

export const dynamic = "force-dynamic";

function decodeCursor(c?: string): { valueDate: string; id: string } | null {
  if (!c) return null;
  try {
    const raw = Buffer.from(c, "base64").toString("utf8");
    const [valueDate, id] = raw.split("|");
    if (!valueDate || !id) return null;
    return { valueDate, id };
  } catch {
    return null;
  }
}

function encodeCursor(valueDate: string, id: string): string {
  return Buffer.from(`${valueDate}|${id}`, "utf8").toString("base64");
}

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const sp = req.nextUrl.searchParams;
    const filters = listFilters.parse({
      accountId: sp.get("accountId") ?? undefined,
      flowType: sp.get("flowType") ?? undefined,
      from: sp.get("from") ?? undefined,
      to: sp.get("to") ?? undefined,
      limit: sp.get("limit") ?? undefined,
      cursor: sp.get("cursor") ?? undefined,
      includeDeleted: sp.get("includeDeleted") ?? undefined,
    });
    await connectMongo();

    const query: Record<string, unknown> = {};
    if (!filters.includeDeleted) query.isDeleted = false;
    if (filters.accountId) query.accountId = filters.accountId;
    if (filters.flowType) query.flowType = filters.flowType;
    if (filters.from || filters.to) {
      const dateClause: Record<string, string> = {};
      if (filters.from) dateClause.$gte = filters.from;
      if (filters.to) dateClause.$lte = filters.to;
      query.valueDate = dateClause;
    }
    const cursor = decodeCursor(filters.cursor);
    if (cursor) {
      query.$or = [
        { valueDate: { $lt: cursor.valueDate } },
        { valueDate: cursor.valueDate, _id: { $lt: cursor.id } },
      ];
    }
    const docs = await TransactionModel.find(query)
      .sort({ valueDate: -1, _id: -1 })
      .limit(filters.limit + 1)
      .lean();
    const hasMore = docs.length > filters.limit;
    const items = hasMore ? docs.slice(0, filters.limit) : docs;
    const last = items[items.length - 1];
    const nextCursor =
      hasMore && last ? encodeCursor(last.valueDate, String(last._id)) : null;
    return NextResponse.json({ items, nextCursor });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const body = await req.json();
    const input = transactionCreateInput.parse(body);
    await connectMongo();

    if (input.flowType === "lending_out") {
      const { transactionId, receivableId } = await createLendingOutWithReceivable({
        valueDate: input.valueDate,
        ...(input.bookedAt ? { bookedAt: input.bookedAt } : {}),
        amountPaise: input.amountPaise,
        direction: input.direction,
        accountId: input.accountId,
        counterpartyId: input.counterpartyId!,
        ...(input.categoryId ? { categoryId: input.categoryId } : {}),
        ...(input.description ? { description: input.description } : {}),
        ...(input.notes ? { notes: input.notes } : {}),
        dueModel: input.dueModel!,
        ...(input.expectedReturnDate ? { expectedReturnDate: input.expectedReturnDate } : {}),
        ...(input.reminderOptIn !== undefined ? { reminderOptIn: input.reminderOptIn } : {}),
        ...(input.reviewStatus ? { reviewStatus: input.reviewStatus } : {}),
        ...(input.source ? { source: input.source } : {}),
      });
      const doc = await TransactionModel.findById(transactionId).lean();
      return NextResponse.json({ ...doc, receivableId }, { status: 201 });
    }

    if (input.flowType === "debt_repayment" && input.debtAccountId) {
      const result = await createDebtRepayment({
        valueDate: input.valueDate,
        ...(input.bookedAt ? { bookedAt: input.bookedAt } : {}),
        amountPaise: input.amountPaise,
        accountId: input.accountId,
        debtAccountId: input.debtAccountId,
        ...(input.counterpartyId ? { counterpartyId: input.counterpartyId } : {}),
        ...(input.categoryId ? { categoryId: input.categoryId } : {}),
        ...(input.description ? { description: input.description } : {}),
        ...(input.notes ? { notes: input.notes } : {}),
        ...(input.recurringRuleId ? { recurringRuleId: input.recurringRuleId } : {}),
        ...(input.source ? { source: input.source } : {}),
        ...(input.reviewStatus ? { reviewStatus: input.reviewStatus } : {}),
      });
      const doc = await TransactionModel.findById(result.transactionId).lean();
      return NextResponse.json(
        {
          ...doc,
          debtSplit: {
            interestPortionPaise: result.interestPortionPaise,
            principalPortionPaise: result.principalPortionPaise,
            outstandingBeforePaise: result.outstandingBeforePaise,
            outstandingAfterPaise: result.outstandingAfterPaise,
          },
        },
        { status: 201 },
      );
    }

    if (input.flowType === "card_settlement") {
      // FR-22 card-in-full guard. Compute the card account's *current* balance
      // (it's a liability, so the absolute value of its balance is what's owed).
      const card = await AccountModel.findById(input.accountId).lean();
      if (card && card.kind === "credit_card") {
        const allTxns = await TransactionModel.find(
          { accountId: card._id, isDeleted: false },
          { _id: 1, accountId: 1, valueDate: 1, flowType: 1, direction: 1, amountPaise: 1, isDeleted: 1, parentTransactionId: 1 },
        ).lean();
        const lite: TxnLite[] = allTxns.map((t) => ({
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
        // Card balance is liability-negative in the ledger; we want the
        // positive-paise "amount owed."
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
      }
    }

    if (input.flowType === "lending_repaid" || input.flowType === "reimbursement_in") {
      const result = await applyRepaymentToReceivable({
        valueDate: input.valueDate,
        ...(input.bookedAt ? { bookedAt: input.bookedAt } : {}),
        amountPaise: input.amountPaise,
        flowType: input.flowType,
        accountId: input.accountId,
        ...(input.counterpartyId ? { counterpartyId: input.counterpartyId } : {}),
        ...(input.categoryId ? { categoryId: input.categoryId } : {}),
        ...(input.description ? { description: input.description } : {}),
        ...(input.notes ? { notes: input.notes } : {}),
        receivableId: input.receivableId!,
        ...(input.acceptOverpayment !== undefined
          ? { acceptOverpayment: input.acceptOverpayment }
          : {}),
        ...(input.source ? { source: input.source } : {}),
      });
      const doc = await TransactionModel.findById(result.transactionId).lean();
      // If the receivable is part of a SplitBill, cascade-recompute participant
      // settled amounts and bill status.
      const recDoc = await ReceivableModel.findById(result.receivableId, {
        splitId: 1,
      }).lean();
      if (recDoc?.splitId) {
        await recomputeBillStatus(String(recDoc.splitId));
      }
      return NextResponse.json(
        { ...doc, receivableNext: result.receivableNext },
        { status: 201 },
      );
    }

    const now = new Date();
    const doc = await TransactionModel.create({
      ...input,
      bookedAt: input.bookedAt ? new Date(input.bookedAt) : now,
      source: input.source ?? "manual",
      reviewStatus: input.reviewStatus ?? "confirmed",
      isDeleted: false,
      editHistory: [],
    });
    return NextResponse.json(doc.toObject(), { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
