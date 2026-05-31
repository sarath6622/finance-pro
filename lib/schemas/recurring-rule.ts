import { z } from "zod";
import {
  arrearsPolicy,
  flowType,
  isoDate,
  objectIdString,
  paiseAmount,
  recurringFrequency,
  recurringStatus,
  syncFields,
} from "./common";

export const recurringRuleSchema = z
  .object({
    _id: objectIdString.optional(),
    label: z.string().min(1).max(100),
    accountId: objectIdString,
    counterpartyId: objectIdString.optional(),
    categoryId: objectIdString.optional(),
    flowType,
    amountPaise: paiseAmount,
    frequency: recurringFrequency,
    dayOfMonth: z.number().int().min(1).max(31).optional(),
    startDate: isoDate,
    endDate: isoDate.optional(),
    debtAccountId: objectIdString.optional(),
    autoGenerate: z.boolean().default(true),
    arrearsPolicy: arrearsPolicy.default("accumulate"),
    status: recurringStatus.default("active"),
  })
  .merge(syncFields);

export type RecurringRule = z.infer<typeof recurringRuleSchema>;
