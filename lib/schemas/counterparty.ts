import { z } from "zod";
import {
  counterpartyType,
  flowType,
  isoDateTime,
  objectIdString,
  syncFields,
} from "./common";

export const counterpartySchema = z
  .object({
    _id: objectIdString.optional(),
    displayName: z.string().min(1).max(100),
    type: counterpartyType,
    aliases: z.array(z.string().min(1)).default([]),
    defaultCategoryId: objectIdString.optional(),
    defaultFlowType: flowType.optional(),
    notes: z.string().max(1000).optional(),
    isActive: z.boolean().default(true),
    archivedAt: isoDateTime.optional(),
  })
  .merge(syncFields);

export type Counterparty = z.infer<typeof counterpartySchema>;
