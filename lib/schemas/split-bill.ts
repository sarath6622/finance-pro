import { z } from "zod";
import {
  objectIdString,
  paiseAmount,
  softDeleteFields,
  splitBillStatus,
  splitParticipantStatus,
  syncFields,
  dueModel,
} from "./common";

export const splitParticipantSchema = z.object({
  counterpartyId: objectIdString,
  sharePaise: paiseAmount.refine((n) => n >= 0, "sharePaise must be >= 0"),
  settledPaise: paiseAmount.default(0),
  status: splitParticipantStatus.default("open"),
  dueModel: dueModel.default("when_able"),
  receivableId: objectIdString.optional(),
});

export const splitBillSchema = z
  .object({
    _id: objectIdString.optional(),
    sourceTransactionId: objectIdString,
    totalPaise: paiseAmount.refine((n) => n > 0, "totalPaise must be > 0"),
    payerAccountId: objectIdString,
    categoryId: objectIdString.optional(),
    participants: z.array(splitParticipantSchema).min(1),
    ownSharePaise: paiseAmount.refine((n) => n >= 0, "ownSharePaise must be >= 0"),
    status: splitBillStatus.default("open"),
    notes: z.string().max(2000).optional(),
  })
  .merge(softDeleteFields)
  .merge(syncFields);

export type SplitParticipant = z.infer<typeof splitParticipantSchema>;
export type SplitBill = z.infer<typeof splitBillSchema>;
