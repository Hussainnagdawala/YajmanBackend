import { z } from "zod";

const paidServiceIdsSchema = z
  .array(z.string().uuid("Each service must be a valid ID"))
  .min(1, "Select at least one paid service");

export const createCouponSchema = z
  .object({
    code: z.string().trim().toUpperCase().min(3, "Coupon code must be at least 3 characters").max(30, "Coupon code must be at most 30 characters"),
    title: z.string().trim().min(1, "Title is required").max(150, "Title must be at most 150 characters"),
    description: z.string().trim().optional(),
    discount_type: z.enum(["percentage", "fixed"], { errorMap: () => ({ message: "Discount type must be 'percentage' or 'fixed'" }) }),
    discount_value: z.coerce.number({ invalid_type_error: "Discount value must be a valid number" }).positive("Discount value must be greater than zero"),
    max_discount_amount: z.coerce.number({ invalid_type_error: "Maximum discount amount must be a valid number" }).positive("Maximum discount amount must be greater than zero").optional(),
    min_order_amount: z.coerce.number({ invalid_type_error: "Minimum order amount must be a valid number" }).nonnegative("Minimum order amount cannot be negative").default(0),
    usage_limit: z.coerce.number({ invalid_type_error: "Usage limit must be a valid number" }).int("Usage limit must be a whole number").positive("Usage limit must be greater than zero").optional(),
    per_user_limit: z.coerce.number({ invalid_type_error: "Per-user limit must be a valid number" }).int("Per-user limit must be a whole number").positive("Per-user limit must be greater than zero").default(1),
    valid_from: z.coerce.date({ invalid_type_error: "Valid from must be a valid date" }),
    valid_until: z.coerce.date({ invalid_type_error: "Valid until must be a valid date" }),
    applicable_services: paidServiceIdsSchema,
  })
  .refine((data) => data.valid_until > data.valid_from, {
    message: "Valid until date must be after the valid from date",
    path: ["valid_until"],
  });

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
  applicable_services: paidServiceIdsSchema.optional(),
  is_active: z.coerce.boolean().optional(),
});

export const validateCouponSchema = z.object({
  code: z.string().trim().min(1),
  service_id: z.string().uuid("Service must be a valid ID"),
  amount: z.coerce.number().positive().optional(),
  quantity: z.coerce
    .number({ invalid_type_error: "Quantity must be a valid number" })
    .int("Quantity must be a whole number")
    .min(1)
    .max(99)
    .optional()
    .default(1),
});

export const listCouponsQuerySchema = z.object({
  service_id: z.string().uuid("Service must be a valid ID").optional(),
});
