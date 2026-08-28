import { z } from "zod";
import { dateStringSchema, timeStringSchema, phoneSchema } from "./common.schema";

export const createOrderSchema = z.object({
  service_id: z.string().uuid("Service must be a valid ID"),
  booking_date: dateStringSchema,
  booking_time: timeStringSchema.optional(),
  customer_name: z.string().trim().min(1, "Customer name is required").max(100, "Customer name must be at most 100 characters"),
  customer_phone: phoneSchema,
  customer_whatsapp: phoneSchema.optional(),
  customer_calling_number: phoneSchema.optional().nullable(),
  customer_email: z.string().email("Email must be a valid email address").max(150, "Email must be at most 150 characters").optional(),
  members: z.array(z.string().trim().min(1, "Member name cannot be empty")).min(1, "At least one member name is required"),
  addon_ids: z.array(z.string().uuid("Each add-on must be a valid ID")).optional().default([]),
  gotra: z.string().trim().max(100, "Gotra must be at most 100 characters").optional(),
  gotra_unknown: z.coerce.boolean().default(false),
  coupon_code: z.string().trim().optional(),
  address: z.string().trim().optional(),
  city: z.string().trim().max(100, "City must be at most 100 characters").optional(),
  pincode: z.string().trim().max(10, "Pincode must be at most 10 characters").optional(),
  special_instructions: z.string().trim().optional(),
  birth_date: dateStringSchema.optional().nullable(),
  birth_time: timeStringSchema.optional().nullable(),
  birth_place: z.string().trim().max(150, "Birth place must be at most 150 characters").optional().nullable(),
});

export const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string().trim().min(1, "Razorpay order ID is required"),
  razorpay_payment_id: z.string().trim().min(1, "Razorpay payment ID is required"),
  razorpay_signature: z.string().trim().min(1, "Payment signature is required"),
});
