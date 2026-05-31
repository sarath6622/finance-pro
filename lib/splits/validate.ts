import { z } from "zod";
import {
  dueModel,
  isoDate,
  objectIdString,
  paiseAmount,
  splitBillStatus,
} from "@/lib/schemas/common";

export const participantShareInput = z.object({
  counterpartyId: objectIdString,
  sharePaise: paiseAmount.refine((n) => n >= 0, "sharePaise must be >= 0"),
  dueModel: dueModel.default("when_able"),
});

export const createSplitBillInput = z.object({
  sourceTransactionId: objectIdString,
  totalPaise: paiseAmount.refine((n) => n > 0, "totalPaise must be > 0"),
  ownSharePaise: paiseAmount.refine((n) => n >= 0, "ownSharePaise must be >= 0"),
  participants: z.array(participantShareInput).min(1),
  notes: z.string().max(2000).optional(),
});

export type CreateSplitBillInput = z.infer<typeof createSplitBillInput>;

export const splitListQuery = z.object({
  status: splitBillStatus.optional(),
  counterpartyId: objectIdString.optional(),
  isTurf: z.coerce.boolean().optional(),
});

export const writeOffParticipantInput = z.object({
  categoryId: objectIdString.optional(),
  notes: z.string().max(2000).optional(),
});

export const matchProposalQuery = z.object({
  counterpartyId: objectIdString,
  asOf: isoDate.optional(),
});

export const turfTemplateInput = z.object({
  payerAccountId: objectIdString,
  categoryId: objectIdString.optional(),
  unitPaise: paiseAmount.refine((n) => n > 0, "unitPaise must be > 0"),
  counterpartyIds: z.array(objectIdString).min(1),
  includeOwner: z.boolean().default(true),
  valueDate: isoDate,
  description: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
});
export type TurfTemplateInput = z.infer<typeof turfTemplateInput>;
