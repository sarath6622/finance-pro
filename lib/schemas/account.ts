import { z } from "zod";
import {
  accountClassification,
  accountKind,
  currencyCode,
  isoDateTime,
  objectIdString,
  paiseAmount,
} from "./common";

export const accountSchema = z.object({
  _id: objectIdString.optional(),
  name: z.string().min(1).max(100),
  kind: accountKind,
  classification: accountClassification,
  currency: currencyCode,
  openingBalancePaise: paiseAmount.default(0),
  openingDate: isoDateTime.optional(),
  creditLimitPaise: paiseAmount.optional(),
  statementDay: z.number().int().min(1).max(31).optional(),
  dueDay: z.number().int().min(1).max(31).optional(),
  interestRatePA: z.number().min(0).max(100).optional(),
  tenureMonths: z.number().int().min(1).optional(),
  emiAmountPaise: paiseAmount.optional(),
  institution: z.string().max(100).optional(),
  last4Label: z
    .string()
    .regex(/^[A-Za-z0-9\-\.\s]{0,10}$/, "Use a masked label only — never full numbers")
    .optional(),
  isActive: z.boolean().default(true),
  archivedAt: isoDateTime.optional(),
});

export type Account = z.infer<typeof accountSchema>;
