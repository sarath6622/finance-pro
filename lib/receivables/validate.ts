import { z } from "zod";
import {
  isoDate,
  objectIdString,
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
