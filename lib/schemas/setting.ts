import { z } from "zod";
import { currencyCode, paiseAmount, syncFieldsSingleton } from "./common";

export const settingSchema = z
  .object({
    liquidityFloorPaise: paiseAmount.default(5000000),
    reminderTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "HH:MM 24-hour")
      .default("21:00"),
    paydayDayOfMonth: z.number().int().min(1).max(31).default(5),
    baseCurrency: currencyCode.default("INR"),
    payCycleMode: z.enum(["calendar", "pay_cycle"]).default("pay_cycle"),
    includePassthroughInReports: z.boolean().default(false),
  })
  .merge(syncFieldsSingleton);

export type Setting = z.infer<typeof settingSchema>;
