import { z } from "zod";

export const createAddonSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    price: z.coerce.number().nonnegative().optional(),
    is_free: z.coerce.boolean().default(false),
    display_order: z.coerce.number().int().default(0),
  })
  .superRefine((data, ctx) => {
    if (!data.is_free && !(data.price && data.price > 0)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["price"], message: "Required unless is_free is true" });
    }
  });

// Independent object, not createAddonSchema.partial() — .partial() only makes
// keys optional, it does not strip inner .default(...), which would silently
// reset display_order on every PATCH omitting it. See category.schema.ts/
// service.schema.ts for the same bug class caught earlier in this codebase.
export const updateAddonSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  price: z.coerce.number().nonnegative().optional(),
  is_free: z.coerce.boolean().optional(),
  display_order: z.coerce.number().int().optional(),
  is_active: z.coerce.boolean().optional(),
});
