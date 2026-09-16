import { z } from "zod";
import { paginationSchema, dateStringSchema } from "./common.schema";

export const listBookingsQuerySchema = paginationSchema.extend({
  status: z.enum(["upcoming", "completed", "cancelled"], {
    errorMap: () => ({ message: "Status must be upcoming, completed, or cancelled" }),
  }).optional(),
});

export const cancelBookingSchema = z.object({
  reason: z.string().trim().min(1, "Cancellation reason is required").max(500, "Cancellation reason must be at most 500 characters"),
});

export const submitReviewSchema = z.object({
  rating: z.coerce
    .number({ invalid_type_error: "Rating must be a valid number" })
    .int("Rating must be a whole number")
    .min(1, "Rating must be at least 1")
    .max(5, "Rating must be at most 5"),
  title: z.string().trim().max(200, "Title must be at most 200 characters").optional(),
  comment: z.string().trim().optional(),
});

export const submitServiceReviewSchema = submitReviewSchema.extend({
  booking_id: z.string().uuid("Booking must be a valid ID"),
});

export const moderateReviewSchema = z.object({
  is_approved: z.coerce.boolean().optional(),
  admin_reply: z.string().trim().optional(),
});

export const listInvoicesQuerySchema = paginationSchema.extend({
  from: dateStringSchema.optional(),
  to: dateStringSchema.optional(),
});

export const listServiceReviewsQuerySchema = paginationSchema.extend({
  sort: z.enum(["newest", "rating"], { errorMap: () => ({ message: "Sort must be 'newest' or 'rating'" }) }).optional(),
});
