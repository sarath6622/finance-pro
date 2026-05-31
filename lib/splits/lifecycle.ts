import { Types } from "mongoose";
import {
  ReceivableModel,
  SplitBillModel,
  TransactionModel,
} from "@/models";
import { conflict, notFound, validation } from "@/lib/http/errors";
import {
  applyRepayment,
  computeOutstanding,
} from "@/lib/receivables/apply-repayment";
import { writeOff, WriteOffError } from "@/lib/receivables/write-off";
import type {
  ReceivableLite,
  RepaymentLite,
} from "@/lib/receivables/types";
import { validateShares } from "./compute-shares";
import { deriveBillStatus, deriveParticipantStatus } from "./derive-status";
import { proposeMatch } from "./match-reimbursement";
import type {
  CreateSplitBillInput,
  TurfTemplateInput,
} from "./validate";
import type { MatchProposal, ParticipantLite } from "./types";

/* ---------- helpers ---------- */

function nowIso(): string {
  return new Date().toISOString();
}

function asLite(doc: Record<string, unknown>): ReceivableLite {
  return {
    _id: String(doc._id),
    counterpartyId: String(doc.counterpartyId),
    kind: doc.kind as ReceivableLite["kind"],
    principalPaise: doc.principalPaise as number,
    dateIncurred: doc.dateIncurred as string,
    accountId: doc.accountId ? String(doc.accountId) : undefined,
    dueModel: (doc.dueModel ?? "none") as ReceivableLite["dueModel"],
    status: doc.status as ReceivableLite["status"],
    repaymentTxnIds: ((doc.repaymentTxnIds as unknown[]) ?? []).map(String),
    ...(doc.splitId ? { splitId: String(doc.splitId) } : {}),
    ...(doc.closedAt
      ? { closedAt: new Date(doc.closedAt as Date).toISOString() }
      : {}),
    ...(doc.expectedReturnDate
      ? { expectedReturnDate: doc.expectedReturnDate as string }
      : {}),
    isDeleted: !!doc.isDeleted,
  };
}

/* ---------- convert spend → SplitBill ---------- */

interface CreateBillResult {
  splitBillId: string;
  receivableIds: string[];
  ownSharePaise: number;
}

export async function convertSpendToSplitBill(
  input: CreateSplitBillInput,
): Promise<CreateBillResult> {
  validateShares(input.totalPaise, input.ownSharePaise, input.participants);

  const txn = await TransactionModel.findById(input.sourceTransactionId).lean();
  if (!txn) throw notFound("Source transaction not found");
  if (txn.isDeleted) throw conflict("Source transaction is soft-deleted");
  if (txn.flowType !== "spend") {
    throw validation(
      `Source transaction must have flowType=spend (got ${txn.flowType})`,
    );
  }
  if (txn.amountPaise !== input.totalPaise) {
    throw validation(
      `totalPaise (${input.totalPaise}) must equal source amountPaise (${txn.amountPaise})`,
    );
  }
  if (txn.splitId) {
    throw conflict("Source transaction is already part of a SplitBill");
  }

  const billId = new Types.ObjectId();
  const now = new Date();

  // Participants with zero share are dropped — no point persisting a no-op IOU.
  const liveParticipants = input.participants.filter((p) => p.sharePaise > 0);
  if (liveParticipants.length === 0) {
    throw validation("At least one participant must have sharePaise > 0");
  }

  // Best-effort atomicity: create receivables first, then SplitBill, then patch txn.
  // If anything fails, hard-delete the receivables we just created.
  const recIds: Types.ObjectId[] = [];
  const participantsForBill: ParticipantLite[] = [];
  try {
    for (const p of liveParticipants) {
      const rec = await ReceivableModel.create({
        counterpartyId: p.counterpartyId,
        kind: "split_iou",
        principalPaise: p.sharePaise,
        dateIncurred: txn.valueDate,
        accountId: txn.accountId,
        repaymentTxnIds: [],
        status: "open",
        dueModel: p.dueModel,
        reminderOptIn: false,
        splitId: billId,
        isDeleted: false,
        editHistory: [],
      });
      recIds.push(rec._id);
      participantsForBill.push({
        counterpartyId: String(p.counterpartyId),
        sharePaise: p.sharePaise,
        settledPaise: 0,
        status: "open",
        dueModel: p.dueModel,
        receivableId: String(rec._id),
      });
    }

    await SplitBillModel.create({
      _id: billId,
      sourceTransactionId: txn._id,
      totalPaise: input.totalPaise,
      payerAccountId: txn.accountId,
      ...(txn.categoryId ? { categoryId: txn.categoryId } : {}),
      participants: participantsForBill,
      ownSharePaise: input.ownSharePaise,
      status: deriveBillStatus(participantsForBill),
      ...(input.notes ? { notes: input.notes } : {}),
    });

    await TransactionModel.findByIdAndUpdate(txn._id, {
      $set: { splitId: billId },
      $push: {
        editHistory: {
          at: now,
          field: "splitId",
          from: null,
          to: String(billId),
        },
      },
    });

    return {
      splitBillId: String(billId),
      receivableIds: recIds.map(String),
      ownSharePaise: input.ownSharePaise,
    };
  } catch (err) {
    if (recIds.length) {
      await ReceivableModel.deleteMany({ _id: { $in: recIds } });
    }
    await SplitBillModel.findByIdAndDelete(billId).catch(() => undefined);
    throw err;
  }
}

/* ---------- one-tap turf template ---------- */

export async function createTurfBill(input: TurfTemplateInput): Promise<{
  transactionId: string;
  splitBillId: string;
  receivableIds: string[];
  totalPaise: number;
}> {
  // Owner pays the whole bill in advance; the source txn is owner's spend of
  // total = unitPaise × (counterpartyIds + (includeOwner ? 1 : 0)).
  const playerCount = input.counterpartyIds.length + (input.includeOwner ? 1 : 0);
  const totalPaise = input.unitPaise * playerCount;
  const ownSharePaise = input.includeOwner ? input.unitPaise : 0;
  const participants = input.counterpartyIds.map((cp) => ({
    counterpartyId: cp,
    sharePaise: input.unitPaise,
    dueModel: "when_able" as const,
  }));

  const txn = await TransactionModel.create({
    valueDate: input.valueDate,
    bookedAt: new Date(),
    amountPaise: totalPaise,
    direction: "out",
    flowType: "spend",
    accountId: input.payerAccountId,
    ...(input.categoryId ? { categoryId: input.categoryId } : {}),
    description: input.description ?? "Turf",
    ...(input.notes ? { notes: input.notes } : {}),
    source: "manual",
    reviewStatus: "confirmed",
    isDeleted: false,
    editHistory: [],
  });
  try {
    const bill = await convertSpendToSplitBill({
      sourceTransactionId: String(txn._id),
      totalPaise,
      ownSharePaise,
      participants,
      ...(input.notes ? { notes: input.notes } : {}),
    });
    return {
      transactionId: String(txn._id),
      splitBillId: bill.splitBillId,
      receivableIds: bill.receivableIds,
      totalPaise,
    };
  } catch (err) {
    await TransactionModel.findByIdAndDelete(txn._id);
    throw err;
  }
}

/* ---------- write off a participant share (E10) ---------- */

export async function writeOffParticipant(
  splitBillId: string,
  counterpartyId: string,
  options: { categoryId?: string; notes?: string } = {},
): Promise<{
  receivableId: string;
  compensatingTxnId: string;
  participantSettled: boolean;
}> {
  const bill = await SplitBillModel.findById(splitBillId).lean();
  if (!bill) throw notFound("SplitBill not found");
  if (bill.isDeleted) throw conflict("SplitBill is soft-deleted");

  const participant = (bill.participants as unknown as ParticipantLite[] | undefined)?.find(
    (p) => String(p.counterpartyId) === counterpartyId,
  );
  if (!participant) throw notFound("Participant not on this bill");
  if (!participant.receivableId) {
    throw conflict("Participant has no linked receivable to write off");
  }

  const recDoc = await ReceivableModel.findById(participant.receivableId).lean();
  if (!recDoc) throw notFound("Linked receivable missing");
  const rec = asLite(recDoc as Record<string, unknown>);

  const repayDocs = await TransactionModel.find(
    {
      receivableId: rec._id,
      isDeleted: false,
      flowType: { $in: ["lending_repaid", "reimbursement_in"] },
    },
    { _id: 1, receivableId: 1, valueDate: 1, amountPaise: 1, flowType: 1 },
  ).lean();
  const reps: RepaymentLite[] = repayDocs.map((t) => ({
    _id: String(t._id),
    receivableId: rec._id,
    valueDate: t.valueDate,
    amountPaise: t.amountPaise,
    isDeleted: false,
    flowType: t.flowType as RepaymentLite["flowType"],
  }));

  let result;
  try {
    result = writeOff(rec, reps, new Date().toISOString().slice(0, 10), nowIso(), {
      ...(options.categoryId ? { categoryId: options.categoryId } : {}),
      ...(options.notes ? { notes: options.notes } : {}),
    });
  } catch (e) {
    if (e instanceof WriteOffError) {
      if (e.code === "already_written_off") throw conflict("Already written off");
      if (e.code === "missing_account") throw conflict("Receivable missing account");
      throw conflict("Nothing outstanding to write off");
    }
    throw e;
  }

  const compTxn = await TransactionModel.create({
    ...result.compensatingTxnDraft,
    bookedAt: new Date(result.compensatingTxnDraft.bookedAt),
    isDeleted: false,
    editHistory: [],
  });

  await ReceivableModel.findByIdAndUpdate(rec._id, {
    $set: {
      status: "written_off",
      closedAt: new Date(),
    },
    $push: {
      editHistory: {
        at: new Date(),
        field: "status",
        from: rec.status,
        to: "written_off",
      },
    },
  });

  await SplitBillModel.updateOne(
    { _id: bill._id, "participants.counterpartyId": new Types.ObjectId(counterpartyId) },
    {
      $set: {
        "participants.$.settledPaise": participant.sharePaise,
        "participants.$.status": "settled",
      },
    },
  );

  await recomputeBillStatus(String(bill._id));

  return {
    receivableId: rec._id,
    compensatingTxnId: String(compTxn._id),
    participantSettled: true,
  };
}

/* ---------- recompute bill participant settled + bill status ---------- */

export async function recomputeBillStatus(splitBillId: string): Promise<void> {
  const bill = await SplitBillModel.findById(splitBillId).lean();
  if (!bill) return;
  const participants = (bill.participants ?? []) as unknown as ParticipantLite[];
  const nextParticipants: ParticipantLite[] = [];
  for (const p of participants) {
    if (!p.receivableId) {
      nextParticipants.push(p);
      continue;
    }
    const rec = await ReceivableModel.findById(p.receivableId).lean();
    if (!rec) {
      nextParticipants.push(p);
      continue;
    }
    if (rec.status === "written_off") {
      nextParticipants.push({
        ...p,
        settledPaise: p.sharePaise,
        status: "settled",
      });
      continue;
    }
    const repDocs = await TransactionModel.find(
      {
        receivableId: rec._id,
        isDeleted: false,
        flowType: { $in: ["lending_repaid", "reimbursement_in"] },
      },
      { amountPaise: 1 },
    ).lean();
    const settled = repDocs.reduce((s, r) => s + (r.amountPaise ?? 0), 0);
    const capped = Math.min(settled, p.sharePaise);
    nextParticipants.push({
      ...p,
      settledPaise: capped,
      status: deriveParticipantStatus(p.sharePaise, capped),
    });
  }
  const status = deriveBillStatus(nextParticipants);
  await SplitBillModel.updateOne(
    { _id: bill._id },
    {
      $set: {
        participants: nextParticipants.map((np) => ({
          counterpartyId: np.counterpartyId,
          sharePaise: np.sharePaise,
          settledPaise: np.settledPaise,
          status: np.status,
          dueModel: np.dueModel,
          ...(np.receivableId ? { receivableId: np.receivableId } : {}),
        })),
        status,
      },
    },
  );
}

/* ---------- reimbursement match proposal ---------- */

export async function proposeMatchForCounterparty(
  counterpartyId: string,
): Promise<MatchProposal | undefined> {
  const recDocs = await ReceivableModel.find({
    counterpartyId,
    kind: "split_iou",
    isDeleted: { $ne: true },
    status: { $in: ["open", "partial"] },
  }).lean();
  if (recDocs.length === 0) return undefined;
  const recs = recDocs.map((d) => asLite(d as Record<string, unknown>));
  const repDocs = await TransactionModel.find(
    {
      receivableId: { $in: recDocs.map((d) => d._id) },
      isDeleted: false,
      flowType: { $in: ["lending_repaid", "reimbursement_in"] },
    },
    { _id: 1, receivableId: 1, valueDate: 1, amountPaise: 1, flowType: 1 },
  ).lean();
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
  return proposeMatch(recs, repsByRec);
}

/* ---------- preview: what would applying X paise to receivable R do? ---------- */

export async function previewReimbursement(
  receivableId: string,
  amountPaise: number,
): Promise<{
  outstandingBefore: number;
  outstandingAfter: number;
  overpaymentPaise: number;
  status: ReceivableLite["status"];
}> {
  const recDoc = await ReceivableModel.findById(receivableId).lean();
  if (!recDoc) throw notFound("Receivable not found");
  const rec = asLite(recDoc as Record<string, unknown>);
  const repDocs = await TransactionModel.find(
    {
      receivableId: rec._id,
      isDeleted: false,
      flowType: { $in: ["lending_repaid", "reimbursement_in"] },
    },
    { _id: 1, valueDate: 1, amountPaise: 1, flowType: 1 },
  ).lean();
  const reps: RepaymentLite[] = repDocs.map((t) => ({
    _id: String(t._id),
    receivableId: rec._id,
    valueDate: t.valueDate,
    amountPaise: t.amountPaise,
    isDeleted: false,
    flowType: t.flowType as RepaymentLite["flowType"],
  }));
  const before = computeOutstanding(rec, reps);
  const next = applyRepayment(
    rec,
    {
      _id: "preview",
      receivableId: rec._id,
      valueDate: new Date().toISOString().slice(0, 10),
      amountPaise,
      isDeleted: false,
      flowType: rec.kind === "cash_loan" ? "lending_repaid" : "reimbursement_in",
    },
    reps,
    nowIso(),
  );
  return {
    outstandingBefore: before.outstandingPaise,
    outstandingAfter: next.outstandingPaise,
    overpaymentPaise: next.overpaymentPaise,
    status: next.status,
  };
}
