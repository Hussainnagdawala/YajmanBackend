import { z } from "zod";
import { paginationSchema } from "./common.schema";

const ORDER_STATUSES = [
  "pending", "confirmed", "pandit_assigned", "in_progress", "completed", "cancelled", "refunded",
  "payment_failed", "refund_failed", "disputed", "all",
] as const;

export const listOrdersAdminQuerySchema = paginationSchema.extend({
  status: z.enum(ORDER_STATUSES).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// cancelled/refunded/refund_failed are deliberately excluded — those are
// side-effecting (Razorpay refund, pandit-freeing) and must go through the
// dedicated /cancel and /retry-refund endpoints instead of this generic PATCH.
export const updateOrderStatusAdminSchema = z.object({
  status: z.enum([
    "pending", "confirmed", "pandit_assigned", "in_progress", "completed", "payment_failed", "disputed",
  ]),
  notes: z.string().trim().max(1000).optional(),
});

export const adminCancelOrderSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});
