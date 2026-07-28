import { z } from "zod";

export const createOrderSchema = z.object({
  service_id: z.string().uuid(),
  booking_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  booking_time: z.string().regex(/^\d{2}:\d{2}$/),
  customer_name: z.string().trim().min(1).max(100),
  customer_phone: z.string().regex(/^[6-9]\d{9}$/),
  customer_whatsapp: z.string().regex(/^[6-9]\d{9}$/).optional(),
  customer_calling_number: z.string().regex(/^[6-9]\d{9}$/).optional().nullable(),
  customer_email: z.string().email().max(150).optional(),
  members: z.array(z.string().trim().min(1)).min(1),
  addon_ids: z.array(z.string().uuid()).optional().default([]),
  gotra: z.string().trim().max(100).optional(),
  gotra_unknown: z.coerce.boolean().default(false),
  coupon_code: z.string().trim().optional(),
  address: z.string().trim().optional(),
  city: z.string().trim().max(100).optional(),
  pincode: z.string().trim().max(10).optional(),
  special_instructions: z.string().trim().optional(),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  birth_time: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  birth_place: z.string().trim().max(150).optional().nullable(),
});

export const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string().trim().min(1),
  razorpay_payment_id: z.string().trim().min(1),
  razorpay_signature: z.string().trim().min(1),
});
