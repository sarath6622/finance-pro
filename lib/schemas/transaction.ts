import { z } from "zod";
import {
  flowType,
  isoDate,
  isoDateTime,
  needWant,
  objectIdString,
  paiseAmount,
  reviewStatus,
  softDeleteFields,
  syncFields,
  txnDirection,
  txnSource,
} from "./common";

export const transactionSchema = z
  .object({
    _id: objectIdString.optional(),
    valueDate: isoDate,
    bookedAt: isoDateTime,
    amountPaise: paiseAmount.refine((n) => n > 0, "amountPaise must be > 0 (use direction)"),
    direction: txnDirection,
    flowType,
    needWant: needWant.optional(),
    categoryId: objectIdString.optional(),
    accountId: objectIdString,
    counterpartyId: objectIdString.optional(),
    source: txnSource.default("manual"),
    description: z.string().max(500).default(""),
    notes: z.string().max(2000).optional(),
    parentTransactionId: objectIdString.optional(),
    receivableId: objectIdString.optional(),
    splitId: objectIdString.optional(),
    holdingId: objectIdString.optional(),
    debtAccountId: objectIdString.optional(),
    interestPortionPaise: paiseAmount.optional(),
    reimbursesTransactionId: objectIdString.optional(),
    recurringRuleId: objectIdString.optional(),
    importBatchId: objectIdString.optional(),
    importHash: z.string().max(128).optional(),
    reviewStatus: reviewStatus.default("confirmed"),
  })
  .merge(softDeleteFields)
  .merge(syncFields);

export type Transaction = z.infer<typeof transactionSchema>;
