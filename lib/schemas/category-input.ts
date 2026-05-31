import { z } from "zod";
import { flowType, objectIdString } from "./common";

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const slugRule = z.string().regex(/^[a-z0-9-]+$/, "slug must be a-z, 0-9, hyphen");

export const categoryCreateInput = z.object({
  name: z.string().min(1).max(80).trim(),
  slug: slugRule.optional(),
  parentId: objectIdString.optional(),
  defaultFlowType: flowType.optional(),
  icon: z.string().max(40).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  sortOrder: z.number().int().optional(),
});
export type CategoryCreateInput = z.infer<typeof categoryCreateInput>;

export const categoryUpdateInput = categoryCreateInput
  .partial()
  .extend({ slug: slugRule.optional() });
export type CategoryUpdateInput = z.infer<typeof categoryUpdateInput>;
