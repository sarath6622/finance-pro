import { z } from "zod";
import { objectIdString, paiseAmount, yyyyMm } from "@/lib/schemas/common";

export const periodQuery = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  mode: z.enum(["calendar", "pay_cycle"]).optional(),
  anchorDay: z.coerce.number().int().min(1).max(31).optional(),
});

export type PeriodQuery = z.infer<typeof periodQuery>;

export const budgetUpsertInput = z.object({
  categoryId: objectIdString,
  month: yyyyMm,
  amountPaise: paiseAmount.refine((n) => n >= 0, "amountPaise must be >= 0"),
  rollover: z.boolean().optional().default(false),
});

export type BudgetUpsertInput = z.infer<typeof budgetUpsertInput>;

export const settingsPatchInput = z.object({
  liquidityFloorPaise: paiseAmount.optional(),
  reminderTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .optional(),
  paydayDayOfMonth: z.coerce.number().int().min(1).max(31).optional(),
  payCycleMode: z.enum(["calendar", "pay_cycle"]).optional(),
  includePassthroughInReports: z.boolean().optional(),
  notifyEnabled: z.boolean().optional(),
});

export type SettingsPatchInput = z.infer<typeof settingsPatchInput>;
