import { z } from "zod";

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a hex color like #ffffff");

export const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().optional(),
  type_ids: z
    .union([z.array(z.string().uuid()), z.string()])
    .transform((val) => (typeof val === "string" ? (val ? [val] : []) : val))
    .optional()
    .default([]),
  display_order: z.coerce.number().int().default(0),
  meta_title: z.string().trim().max(200).optional(),
  meta_description: z.string().trim().optional(),
});

export const updateCategorySchema = createCategorySchema.partial().extend({
  is_active: z.coerce.boolean().optional(),
});

export const createTypeSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().optional(),
  display_order: z.coerce.number().int().default(0),
});

export const updateTypeSchema = createTypeSchema.partial().extend({
  is_active: z.coerce.boolean().optional(),
});

export const createTagSchema = z.object({
  name: z.string().trim().min(1).max(50),
  color: hexColor.optional(),
  bg_color: hexColor.optional(),
  display_order: z.coerce.number().int().default(0),
});

export const updateTagSchema = createTagSchema.partial().extend({
  is_active: z.coerce.boolean().optional(),
});
