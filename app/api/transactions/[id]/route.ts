import { NextResponse, type NextRequest } from "next/server";
import { connectMongo } from "@/lib/db/mongo";
import { requireSession } from "@/lib/auth/session";
import { conflict, errorResponse, notFound } from "@/lib/http/errors";
import { ReceivableModel, SplitBillModel, TransactionModel } from "@/models";
import {
  applyEditHistory,
  markSoftDeleted,
  transactionPatchInput,
} from "@/lib/transactions";
import { cascadeOnTxnDelete } from "@/lib/receivables/lifecycle";
import { recomputeBillStatus } from "@/lib/splits/lifecycle";

export const dynamic = "force-dynamic";

const SPLIT_PARENT_EDITABLE = new Set(["description", "notes", "valueDate"]);
const RECEIVABLE_LINKED_EDITABLE = new Set([
  "description",
  "notes",
  "valueDate",
  "categoryId",
]);
const TRANSFER_LEG_EDITABLE = new Set(["description", "notes"]);

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireSession();
    await connectMongo();
    const doc = await TransactionModel.findById(params.id).lean();
    if (!doc) throw notFound("Transaction not found");
    return NextResponse.json(doc);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireSession();
    const body = await req.json();
    const patch = transactionPatchInput.parse(body);
    await connectMongo();
    const prev = await TransactionModel.findById(params.id).lean();
    if (!prev) throw notFound("Transaction not found");
    if (prev.isDeleted) throw conflict("Transaction is soft-deleted");

    const liveChildren = await TransactionModel.countDocuments({
      parentTransactionId: prev._id,
      isDeleted: false,
    });
    const isParentContainer = liveChildren > 0;

    const patchedFields = Object.keys(patch);
    if (isParentContainer) {
      for (const f of patchedFields) {
        if (!SPLIT_PARENT_EDITABLE.has(f)) {
          throw conflict(
            `Split-parent containers only allow ${[...SPLIT_PARENT_EDITABLE].join("/")}; edit children individually.`,
          );
        }
      }
    }

    if (prev.receivableId) {
      for (const f of patchedFields) {
        if (!RECEIVABLE_LINKED_EDITABLE.has(f)) {
          throw conflict(
            `Receivable-linked transactions only allow ${[...RECEIVABLE_LINKED_EDITABLE].join("/")} edits. To change amount or account, delete this entry and re-create it.`,
          );
        }
      }
    }

    if (prev.reimbursesTransactionId && (prev as { flowType?: string }).flowType === "transfer") {
      for (const f of patchedFields) {
        if (!TRANSFER_LEG_EDITABLE.has(f)) {
          throw conflict("Transfer legs are immutable in P1 (paired-edit lands in P10).");
        }
      }
    }

    if ("amountPaise" in patch && prev.parentTransactionId) {
      const parent = await TransactionModel.findById(prev.parentTransactionId).lean();
      if (!parent) throw conflict("Child's parent transaction missing");
      const otherSiblings = await TransactionModel.find({
        parentTransactionId: prev._id ? prev.parentTransactionId : null,
        _id: { $ne: prev._id },
        isDeleted: false,
      }).lean();
      const othersSum = otherSiblings.reduce((s, c) => s + c.amountPaise, 0);
      const newAmount = patch.amountPaise ?? prev.amountPaise;
      if (othersSum + newAmount !== parent.amountPaise) {
        throw conflict(
          `Edit would break parent sum: siblings ${othersSum} + this ${newAmount} ≠ parent ${parent.amountPaise}`,
        );
      }
    }

    const nowIso = new Date().toISOString();
    const { next, entries } = applyEditHistory(
      prev as Record<string, unknown>,
      patch as Record<string, unknown>,
      nowIso,
    );

    if (entries.length === 0) {
      return NextResponse.json(prev);
    }

    const setFields: Record<string, unknown> = {};
    for (const e of entries) setFields[e.field] = next[e.field];

    const updated = await TransactionModel.findByIdAndUpdate(
      params.id,
      { $set: setFields, $push: { editHistory: { $each: entries } } },
      { new: true },
    ).lean();
    return NextResponse.json(updated);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireSession();
    await connectMongo();
    const prev = await TransactionModel.findById(params.id).lean();
    if (!prev) throw notFound("Transaction not found");
    if (prev.isDeleted) throw conflict("Already soft-deleted");

    // SplitBill cascade: deleting the source spend tears down the bill and
    // soft-deletes its linked split_iou receivables. Block if any participant
    // has live reimbursement_in repayments (would leave orphan inbound money).
    if (prev.splitId) {
      const liveRepayments = await TransactionModel.countDocuments({
        flowType: "reimbursement_in",
        receivableId: {
          $in: await ReceivableModel.find({ splitId: prev.splitId }, { _id: 1 })
            .lean()
            .then((rs) => rs.map((r) => r._id)),
        },
        isDeleted: false,
      });
      if (liveRepayments > 0) {
        throw conflict(
          "Cannot delete the source of a SplitBill while reimbursements exist — delete repayments first.",
        );
      }
    }

    const liveChildren = await TransactionModel.countDocuments({
      parentTransactionId: prev._id,
      isDeleted: false,
    });
    if (liveChildren > 0) {
      throw conflict(
        `Parent has ${liveChildren} live children — delete or unsplit children first`,
      );
    }

    // Receivable-linked cascade: lending_out parent, repayment, write-off compensating spend
    let cascadeInfo: Awaited<ReturnType<typeof cascadeOnTxnDelete>> | undefined;
    if (prev.receivableId) {
      cascadeInfo = await cascadeOnTxnDelete({
        prevTxn: {
          _id: String(prev._id),
          flowType: prev.flowType,
          direction: prev.direction,
          amountPaise: prev.amountPaise,
          receivableId: String(prev.receivableId),
          valueDate: prev.valueDate,
          isDeleted: prev.isDeleted ?? false,
        },
      });
      // If the receivable lives inside a SplitBill, propagate to participant settled state.
      const recDoc = await ReceivableModel.findById(prev.receivableId, {
        splitId: 1,
      }).lean();
      if (recDoc?.splitId) {
        await recomputeBillStatus(String(recDoc.splitId));
      }
    }

    // SplitBill source spend: soft-delete bill + cascade soft-delete linked
    // receivables (only reaches here if no live reimbursements blocked above).
    if (prev.splitId) {
      const bill = await SplitBillModel.findById(prev.splitId).lean();
      if (bill && !bill.isDeleted) {
        const recIds = (bill.participants ?? [])
          .map((p) => p.receivableId)
          .filter((x): x is NonNullable<typeof x> => !!x);
        const now = new Date();
        if (recIds.length) {
          await ReceivableModel.updateMany(
            { _id: { $in: recIds }, isDeleted: { $ne: true } },
            {
              $set: { isDeleted: true, deletedAt: now },
              $push: {
                editHistory: {
                  at: now,
                  field: "isDeleted",
                  from: false,
                  to: true,
                },
              },
            },
          );
        }
        await SplitBillModel.findByIdAndUpdate(prev.splitId, {
          $set: { isDeleted: true, deletedAt: now },
        });
      }
    }

    const nowIso = new Date().toISOString();
    const { entries } = markSoftDeleted(prev as Record<string, unknown>, nowIso);
    const updated = await TransactionModel.findByIdAndUpdate(
      params.id,
      {
        $set: { isDeleted: true, deletedAt: new Date(nowIso) },
        $push: { editHistory: { $each: entries } },
      },
      { new: true },
    ).lean();
    return NextResponse.json({ ...updated, ...(cascadeInfo ? { receivableCascade: cascadeInfo } : {}) });
  } catch (e) {
    return errorResponse(e);
  }
}
