import { z } from "zod";
import {
  arrearsPolicy,
  flowType,
  isoDate,
  objectIdString,
  paiseAmount,
  recurringFrequency,
  recurringStatus,
} from "@/lib/schemas/common";

export const recurringRuleCreateInput = z
  .object({
    label: z.string().min(1).max(100),
    accountId: objectIdString,
    counterpartyId: objectIdString.optional(),
    categoryId: objectIdString.optional(),
    flowType,
    amountPaise: paiseAmount.refine((n) => n > 0, "amountPaise must be > 0"),
    frequency: recurringFrequency,
    dayOfMonth: z.coerce.number().int().min(1).max(31).optional(),
    startDate: isoDate,
    endDate: isoDate.optional(),
    arrearsPolicy: arrearsPolicy.optional().default("accumulate"),
    status: recurringStatus.optional().default("active"),
    autoGenerate: z.boolean().optional().default(false),
  })
  .refine((d) => d.frequency !== "monthly" || !!d.dayOfMonth, {
    message: "monthly rules require dayOfMonth",
    path: ["dayOfMonth"],
  })
  .refine((d) => !d.endDate || d.endDate >= d.startDate, {
    message: "endDate must be on or after startDate",
    path: ["endDate"],
  });

export type RecurringRuleCreateInput = z.infer<typeof recurringRuleCreateInput>;

export const recurringRulePatchInput = z
  .object({
    label: z.string().min(1).max(100).optional(),
    counterpartyId: objectIdString.optional(),
    categoryId: objectIdString.optional(),
    amountPaise: paiseAmount.refine((n) => n > 0).optional(),
    dayOfMonth: z.coerce.number().int().min(1).max(31).optional(),
    endDate: isoDate.optional(),
    arrearsPolicy: arrearsPolicy.optional(),
    status: recurringStatus.optional(),
    autoGenerate: z.boolean().optional(),
  })
  .refine(
    (d) => Object.values(d).some((v) => v !== undefined),
    "patch must include at least one field",
  );

export type RecurringRulePatchInput = z.infer<typeof recurringRulePatchInput>;

export const obligationsQuery = z.object({
  asOf: isoDate.optional(),
  horizonDays: z.coerce.number().int().min(0).max(365).optional().default(30),
});

export type ObligationsQuery = z.infer<typeof obligationsQuery>;
