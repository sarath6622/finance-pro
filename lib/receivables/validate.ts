import { z } from "zod";
import {
  dueModel,
  isoDate,
  objectIdString,
  paiseAmount,
  receivableKind,
  receivableStatus,
} from "@/lib/schemas/common";

export const receivableListQuery = z.object({
  status: receivableStatus.optional(),
  counterpartyId: objectIdString.optional(),
  kind: receivableKind.optional(),
  includeWrittenOff: z.coerce.boolean().optional().default(false),
  asOf: isoDate.optional(),
});

export type ReceivableListQuery = z.infer<typeof receivableListQuery>;

export const exposureQuery = z.object({
  asOf: isoDate.optional(),
  includeWrittenOff: z.coerce.boolean().optional().default(false),
});

export type ExposureQuery = z.infer<typeof exposureQuery>;

export const writeOffInput = z.object({
  categoryId: objectIdString.optional(),
  notes: z.string().max(2000).optional(),
});

export type WriteOffInput = z.infer<typeof writeOffInput>;

export const importReceivableInput = z.object({
  counterpartyId: objectIdString,
  principalPaise: paiseAmount.refine((n) => n > 0, "principalPaise must be > 0"),
  dateIncurred: isoDate,
  dueModel: dueModel.default("none"),
  expectedReturnDate: isoDate.optional(),
  notes: z.string().max(2000).optional(),
});

export type ImportReceivableInput = z.infer<typeof importReceivableInput>;
