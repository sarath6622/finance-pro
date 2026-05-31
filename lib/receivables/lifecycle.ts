import { Types } from "mongoose";
import { ReceivableModel, TransactionModel } from "@/models";
import { ApiError, conflict, notFound, validation } from "@/lib/http/errors";
import { applyRepayment, recomputeReceivableState } from "./apply-repayment";
import type { ReceivableLite, ReceivableNext, RepaymentLite } from "./types";

interface LendingOutInput {
  valueDate: string;
  bookedAt?: string;
  amountPaise: number;
  direction: "in" | "out";
  accountId: string;
  counterpartyId: string;
  categoryId?: string;
  description?: string;
  notes?: string;
  dueModel: "on_date" | "when_able" | "none";
  expectedReturnDate?: string;
  reminderOptIn?: boolean;
  reviewStatus?: "confirmed" | "needs_review";
  source?: "manual" | "import" | "recurring" | "split_child";
}

export async function createLendingOutWithReceivable(input: LendingOutInput): Promise<{
  transactionId: string;
  receivableId: string;
}> {
  const now = new Date();
  const bookedAt = input.bookedAt ? new Date(input.bookedAt) : now;

  // Best-effort: create transaction first, then receivable, then patch the txn with receivableId.
  // If receivable insert fails, hard-delete the orphan transaction (never been visible to client).
  const txn = await TransactionModel.create({
    valueDate: input.valueDate,
    bookedAt,
    amountPaise: input.amountPaise,
    direction: input.direction,
    flowType: "lending_out",
    accountId: input.accountId,
    counterpartyId: input.counterpartyId,
    ...(input.categoryId ? { categoryId: input.categoryId } : {}),
    description: input.description ?? "",
    ...(input.notes ? { notes: input.notes } : {}),
    source: input.source ?? "manual",
    reviewStatus: input.reviewStatus ?? "confirmed",
    isDeleted: false,
    editHistory: [],
  });

  try {
    const rec = await ReceivableModel.create({
      counterpartyId: input.counterpartyId,
      kind: "cash_loan",
      principalPaise: input.amountPaise,
      dateIncurred: input.valueDate,
      accountId: input.accountId,
      repaymentTxnIds: [],
      status: "open",
      dueModel: input.dueModel,
      ...(input.expectedReturnDate ? { expectedReturnDate: input.expectedReturnDate } : {}),
      reminderOptIn: input.reminderOptIn ?? false,
      ...(input.notes ? { notes: input.notes } : {}),
      isDeleted: false,
      editHistory: [],
    });

    await TransactionModel.findByIdAndUpdate(txn._id, { $set: { receivableId: rec._id } });
    return { transactionId: String(txn._id), receivableId: String(rec._id) };
  } catch (err) {
    await TransactionModel.findByIdAndDelete(txn._id);
    throw err;
  }
}

interface RepaymentInput {
  valueDate: string;
  bookedAt?: string;
  amountPaise: number;
  flowType: "lending_repaid" | "reimbursement_in";
  accountId: string;
  counterpartyId?: string;
  categoryId?: string;
  description?: string;
  notes?: string;
  receivableId: string;
  acceptOverpayment?: boolean;
  source?: "manual" | "import" | "recurring" | "split_child";
}

export async function applyRepaymentToReceivable(input: RepaymentInput): Promise<{
  transactionId: string;
  receivableId: string;
  receivableNext: ReceivableNext;
}> {
  const recDoc = await ReceivableModel.findById(input.receivableId).lean();
  if (!recDoc) throw notFound("Receivable not found");
  if (recDoc.isDeleted) throw conflict("Receivable is soft-deleted");
  if (recDoc.status === "written_off") {
    throw conflict("Cannot repay a written-off receivable");
  }
  if (recDoc.kind === "cash_loan" && input.flowType !== "lending_repaid") {
    throw validation(
      "cash_loan receivables expect lending_repaid (got " + input.flowType + ")",
    );
  }
  if (recDoc.kind === "split_iou" && input.flowType !== "reimbursement_in") {
    throw validation(
      "split_iou receivables expect reimbursement_in (got " + input.flowType + ")",
    );
  }

  const existing = await TransactionModel.find(
    { receivableId: recDoc._id, isDeleted: false },
    { _id: 1, amountPaise: 1, valueDate: 1, flowType: 1 },
  ).lean();

  const recLite: ReceivableLite = {
    _id: String(recDoc._id),
    counterpartyId: String(recDoc.counterpartyId),
    kind: recDoc.kind as ReceivableLite["kind"],
    principalPaise: recDoc.principalPaise,
    dateIncurred: recDoc.dateIncurred,
    accountId: recDoc.accountId ? String(recDoc.accountId) : undefined,
    dueModel: (recDoc.dueModel ?? "none") as ReceivableLite["dueModel"],
    status: recDoc.status as ReceivableLite["status"],
    repaymentTxnIds: (recDoc.repaymentTxnIds ?? []).map(String),
  };
  const liveReps: RepaymentLite[] = existing
    .filter((t) => t.flowType === "lending_repaid" || t.flowType === "reimbursement_in")
    .map((t) => ({
      _id: String(t._id),
      receivableId: String(recDoc._id),
      valueDate: t.valueDate,
      amountPaise: t.amountPaise,
      isDeleted: false,
      flowType: t.flowType as RepaymentLite["flowType"],
    }));

  const nowIso = new Date().toISOString();
  const provisionalId = new Types.ObjectId().toString();
  const provisionalRepayment: RepaymentLite = {
    _id: provisionalId,
    receivableId: recLite._id,
    valueDate: input.valueDate,
    amountPaise: input.amountPaise,
    isDeleted: false,
    flowType: input.flowType,
  };
  const next = applyRepayment(recLite, provisionalRepayment, liveReps, nowIso);
  if (next.overpaymentPaise > 0 && !input.acceptOverpayment) {
    throw new ApiError(
      "conflict",
      `Repayment exceeds outstanding by ${next.overpaymentPaise} paise. Pass acceptOverpayment=true to record as advance.`,
      { overpaymentPaise: next.overpaymentPaise },
    );
  }

  const txn = await TransactionModel.create({
    _id: new Types.ObjectId(provisionalId),
    valueDate: input.valueDate,
    bookedAt: input.bookedAt ? new Date(input.bookedAt) : new Date(),
    amountPaise: input.amountPaise,
    direction: "in",
    flowType: input.flowType,
    accountId: input.accountId,
    ...(input.counterpartyId ? { counterpartyId: input.counterpartyId } : {}),
    ...(input.categoryId ? { categoryId: input.categoryId } : {}),
    description: input.description ?? "",
    ...(input.notes ? { notes: input.notes } : {}),
    receivableId: recDoc._id,
    source: input.source ?? "manual",
    reviewStatus: "confirmed",
    isDeleted: false,
    editHistory: [],
  });

  await ReceivableModel.findByIdAndUpdate(recDoc._id, {
    $set: {
      status: next.status,
      ...(next.closedAt ? { closedAt: new Date(next.closedAt) } : {}),
    },
    $addToSet: { repaymentTxnIds: txn._id },
  });

  return {
    transactionId: String(txn._id),
    receivableId: String(recDoc._id),
    receivableNext: next,
  };
}

interface CascadeContext {
  prevTxn: {
    _id: string;
    flowType: string;
    direction: string;
    amountPaise: number;
    receivableId?: string;
    valueDate: string;
    isDeleted?: boolean;
  };
}

export async function cascadeOnTxnDelete(ctx: CascadeContext): Promise<{
  receivableUpdated?: { _id: string; status: string; closedAt?: string };
  receivableSoftDeleted?: string;
}> {
  const { prevTxn } = ctx;
  if (!prevTxn.receivableId) return {};
  const recDoc = await ReceivableModel.findById(prevTxn.receivableId).lean();
  if (!recDoc) return {};
  const nowIso = new Date().toISOString();

  if (prevTxn.flowType === "lending_out") {
    const liveOthers = await TransactionModel.find({
      receivableId: recDoc._id,
      _id: { $ne: prevTxn._id },
      isDeleted: false,
    }).countDocuments();
    if (liveOthers > 0) {
      throw conflict(
        "Cannot delete lending_out parent — settle or delete its repayments first",
      );
    }
    await ReceivableModel.findByIdAndUpdate(recDoc._id, {
      $set: {
        isDeleted: true,
        deletedAt: new Date(nowIso),
      },
      $push: {
        editHistory: {
          at: new Date(nowIso),
          field: "isDeleted",
          from: false,
          to: true,
        },
      },
    });
    return { receivableSoftDeleted: String(recDoc._id) };
  }

  if (prevTxn.flowType === "lending_repaid" || prevTxn.flowType === "reimbursement_in") {
    const remaining = await TransactionModel.find(
      {
        receivableId: recDoc._id,
        _id: { $ne: prevTxn._id },
        isDeleted: false,
      },
      { _id: 1, amountPaise: 1, valueDate: 1, flowType: 1 },
    ).lean();
    const recLite: ReceivableLite = {
      _id: String(recDoc._id),
      counterpartyId: String(recDoc.counterpartyId),
      kind: recDoc.kind as ReceivableLite["kind"],
      principalPaise: recDoc.principalPaise,
      dateIncurred: recDoc.dateIncurred,
      accountId: recDoc.accountId ? String(recDoc.accountId) : undefined,
      dueModel: (recDoc.dueModel ?? "none") as ReceivableLite["dueModel"],
      status: recDoc.status as ReceivableLite["status"],
      repaymentTxnIds: (recDoc.repaymentTxnIds ?? []).map(String),
    };
    const repaymentsOnly: RepaymentLite[] = remaining
      .filter(
        (t) => t.flowType === "lending_repaid" || t.flowType === "reimbursement_in",
      )
      .map((t) => ({
        _id: String(t._id),
        receivableId: String(recDoc._id),
        valueDate: t.valueDate,
        amountPaise: t.amountPaise,
        isDeleted: false,
        flowType: t.flowType as RepaymentLite["flowType"],
      }));
    const next = recomputeReceivableState(recLite, repaymentsOnly, nowIso);
    await ReceivableModel.findByIdAndUpdate(recDoc._id, {
      $set: {
        status: next.status,
        ...(next.status === "closed" && next.closedAt
          ? { closedAt: new Date(next.closedAt) }
          : { closedAt: undefined }),
      },
      $pull: { repaymentTxnIds: new Types.ObjectId(prevTxn._id) },
    });
    return {
      receivableUpdated: {
        _id: String(recDoc._id),
        status: next.status,
        ...(next.closedAt ? { closedAt: next.closedAt } : {}),
      },
    };
  }

  // Write-off compensating spend: block via 409 — undo lands later
  if (prevTxn.flowType === "spend") {
    throw conflict(
      "Cannot delete a write-off compensating transaction directly. Undo via the receivable.",
    );
  }
  return {};
}
