import { z } from "zod";
import { paginationSchema } from "./common.schema";

const ORDER_STATUSES = [
  "pending", "confirmed", "pandit_assigned", "in_progress", "completed", "cancelled", "refunded", "all",
] as const;

export const listOrdersAdminQuerySchema = paginationSchema.extend({
  status: z.enum(ORDER_STATUSES).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const updateOrderStatusAdminSchema = z.object({
  status: z.enum([
    "pending", "confirmed", "pandit_assigned", "in_progress", "completed", "cancelled", "refunded",
  ]),
  notes: z.string().trim().max(1000).optional(),
});
