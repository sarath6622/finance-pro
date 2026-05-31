import { z } from "zod";
import { counterpartyType, flowType, objectIdString } from "./common";

export const counterpartyCreateInput = z.object({
  displayName: z.string().min(1).max(100).trim(),
  type: counterpartyType,
  aliases: z.array(z.string().min(1).trim()).default([]),
  defaultCategoryId: objectIdString.optional(),
  defaultFlowType: flowType.optional(),
  notes: z.string().max(1000).optional(),
});
export type CounterpartyCreateInput = z.infer<typeof counterpartyCreateInput>;

export const counterpartyUpdateInput = counterpartyCreateInput.partial();
export type CounterpartyUpdateInput = z.infer<typeof counterpartyUpdateInput>;
