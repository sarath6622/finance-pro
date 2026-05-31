import { z } from "zod";
import {
  dueModel,
  isoDate,
  isoDateTime,
  objectIdString,
  paiseAmount,
  receivableKind,
  receivableStatus,
  softDeleteFields,
  syncFields,
} from "./common";

export const receivableSchema = z
  .object({
    _id: objectIdString.optional(),
    counterpartyId: objectIdString,
    kind: receivableKind,
    principalPaise: paiseAmount.refine((n) => n > 0, "principalPaise must be > 0"),
    dateIncurred: isoDate,
    accountId: objectIdString.optional(),
    repaymentTxnIds: z.array(objectIdString).default([]),
    status: receivableStatus.default("open"),
    dueModel: dueModel.default("none"),
    expectedReturnDate: isoDate.optional(),
    reminderOptIn: z.boolean().default(false),
    splitId: objectIdString.optional(),
    notes: z.string().max(2000).optional(),
    createdAt: isoDateTime.optional(),
    closedAt: isoDateTime.optional(),
  })
  .merge(softDeleteFields)
  .merge(syncFields);

export type Receivable = z.infer<typeof receivableSchema>;
