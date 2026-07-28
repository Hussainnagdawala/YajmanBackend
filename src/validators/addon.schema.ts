import { z } from "zod";

export const createAddonSchema = z.object({
  name: z.string().trim().min(1).max(100),
  price: z.coerce.number().positive(),
  display_order: z.coerce.number().int().default(0),
});

// Independent object, not createAddonSchema.partial() — .partial() only makes
// keys optional, it does not strip inner .default(...), which would silently
// reset display_order on every PATCH omitting it. See category.schema.ts/
// service.schema.ts for the same bug class caught earlier in this codebase.
export const updateAddonSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  price: z.coerce.number().positive().optional(),
  display_order: z.coerce.number().int().optional(),
  is_active: z.coerce.boolean().optional(),
});
