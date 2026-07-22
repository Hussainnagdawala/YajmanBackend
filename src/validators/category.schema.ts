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

// NOTE: independent objects, not createXSchema.partial() — .partial() only makes
// keys optional, it does not strip inner .default(...), so a PATCH omitting
// display_order (or type_ids) would silently reset it / clear the junction on
// every update. See service.schema.ts for the same bug caught during Step 5.
export const updateCategorySchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().optional(),
  type_ids: z
    .union([z.array(z.string().uuid()), z.string()])
    .transform((val) => (typeof val === "string" ? (val ? [val] : []) : val))
    .optional(),
  display_order: z.coerce.number().int().optional(),
  meta_title: z.string().trim().max(200).optional(),
  meta_description: z.string().trim().optional(),
  is_active: z.coerce.boolean().optional(),
});

export const createTypeSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().optional(),
  display_order: z.coerce.number().int().default(0),
});

export const updateTypeSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().optional(),
  display_order: z.coerce.number().int().optional(),
  is_active: z.coerce.boolean().optional(),
});

export const createTagSchema = z.object({
  name: z.string().trim().min(1).max(50),
  color: hexColor.optional(),
  bg_color: hexColor.optional(),
  display_order: z.coerce.number().int().default(0),
});

export const updateTagSchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  color: hexColor.optional(),
  bg_color: hexColor.optional(),
  display_order: z.coerce.number().int().optional(),
  is_active: z.coerce.boolean().optional(),
});
