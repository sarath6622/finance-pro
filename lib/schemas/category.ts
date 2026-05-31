import { z } from "zod";
import { flowType, objectIdString } from "./common";

export const categorySchema = z.object({
  _id: objectIdString.optional(),
  name: z.string().min(1).max(80),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  parentId: objectIdString.optional(),
  defaultFlowType: flowType.optional(),
  icon: z.string().max(40).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export type Category = z.infer<typeof categorySchema>;
