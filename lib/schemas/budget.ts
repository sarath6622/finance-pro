import { z } from "zod";
import { objectIdString, paiseAmount, yyyyMm } from "./common";

export const budgetSchema = z.object({
  _id: objectIdString.optional(),
  categoryId: objectIdString,
  month: yyyyMm,
  amountPaise: paiseAmount.refine((n) => n >= 0, "amountPaise must be >= 0"),
  rollover: z.boolean().default(false),
});

export type Budget = z.infer<typeof budgetSchema>;
