import { z } from "zod";

export const createCouponSchema = z.object({
  code: z.string().trim().toUpperCase().min(3).max(30),
  title: z.string().trim().min(1).max(150),
  description: z.string().trim().optional(),
  discount_type: z.enum(["percentage", "fixed"]),
  discount_value: z.coerce.number().positive(),
  max_discount_amount: z.coerce.number().positive().optional(),
  min_order_amount: z.coerce.number().nonnegative().default(0),
  usage_limit: z.coerce.number().int().positive().optional(),
  per_user_limit: z.coerce.number().int().positive().default(1),
  valid_from: z.coerce.date(),
  valid_until: z.coerce.date(),
  applicable_categories: z.array(z.string().uuid()).optional(),
  applicable_services: z.array(z.string().uuid()).optional(),
}).refine((data) => data.valid_until > data.valid_from, {
  message: "valid_until must be after valid_from",
  path: ["valid_until"],
});

// Independent object, not createCouponSchema.partial() — see service.schema.ts
// / README for why that pattern silently resets omitted fields on every PATCH.
export const updateCouponSchema = z.object({
  code: z.string().trim().toUpperCase().min(3).max(30).optional(),
  title: z.string().trim().min(1).max(150).optional(),
  description: z.string().trim().optional(),
  discount_type: z.enum(["percentage", "fixed"]).optional(),
  discount_value: z.coerce.number().positive().optional(),
  max_discount_amount: z.coerce.number().positive().optional(),
  min_order_amount: z.coerce.number().nonnegative().optional(),
  usage_limit: z.coerce.number().int().positive().optional(),
  per_user_limit: z.coerce.number().int().positive().optional(),
  valid_from: z.coerce.date().optional(),
  valid_until: z.coerce.date().optional(),
  applicable_categories: z.array(z.string().uuid()).optional(),
  applicable_services: z.array(z.string().uuid()).optional(),
  is_active: z.coerce.boolean().optional(),
});

export const validateCouponSchema = z.object({
  code: z.string().trim().min(1),
  service_id: z.string().uuid().optional(),
  amount: z.coerce.number().positive(),
});
