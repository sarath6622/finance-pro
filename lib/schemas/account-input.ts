import { z } from "zod";
import {
  accountClassification,
  accountKind,
  isoDateTime,
  paiseAmount,
} from "./common";

const last4 = z
  .string()
  .regex(/^[A-Za-z0-9\-\.\s]{0,10}$/, "Use a masked label only — never full numbers")
  .max(10);

export const accountCreateInput = z.object({
  name: z.string().min(1).max(100).trim(),
  kind: accountKind,
  classification: accountClassification,
  institution: z.string().max(100).trim().optional(),
  last4Label: last4.optional(),
  openingBalancePaise: paiseAmount.default(0),
  openingDate: isoDateTime.optional(),
  creditLimitPaise: paiseAmount.nonnegative().optional(),
  statementDay: z.number().int().min(1).max(31).optional(),
  dueDay: z.number().int().min(1).max(31).optional(),
  interestRatePA: z.number().min(0).max(100).optional(),
  tenureMonths: z.number().int().min(1).optional(),
  emiAmountPaise: paiseAmount.nonnegative().optional(),
});
export type AccountCreateInput = z.infer<typeof accountCreateInput>;

export const accountUpdateInput = accountCreateInput.partial().extend({
  acceptOpeningBalanceCascade: z.boolean().optional(),
});
export type AccountUpdateInput = z.infer<typeof accountUpdateInput>;
