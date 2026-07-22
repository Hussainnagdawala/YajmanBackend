import { z } from "zod";
import { paginationSchema } from "./common.schema";

export const listBookingsQuerySchema = paginationSchema.extend({
  status: z.enum(["upcoming", "completed", "cancelled"]).optional(),
});

export const cancelBookingSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

export const submitReviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().max(200).optional(),
  comment: z.string().trim().optional(),
});

export const submitServiceReviewSchema = submitReviewSchema.extend({
  booking_id: z.string().uuid(),
});

export const moderateReviewSchema = z.object({
  is_approved: z.coerce.boolean().optional(),
  admin_reply: z.string().trim().optional(),
});

export const listInvoicesQuerySchema = paginationSchema.extend({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const listServiceReviewsQuerySchema = paginationSchema.extend({
  sort: z.enum(["newest", "rating"]).optional(),
});
