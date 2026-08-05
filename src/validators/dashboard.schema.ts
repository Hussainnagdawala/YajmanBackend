import { z } from "zod";

export const dashboardTrendsQuerySchema = z
  .object({
    metric: z.enum(["orders", "revenue", "users", "views"]),
    period: z.enum(["daily", "weekly", "monthly"]).default("daily"),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })
  .refine((data) => !data.from || !data.to || data.from <= data.to, {
    message: "from must be before to",
    path: ["from"],
  });

export const dashboardTopServicesQuerySchema = z.object({
  by: z.enum(["bookings", "revenue", "views"]).default("bookings"),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const dashboardPanditPerformanceQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const dashboardTopCouponsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const userViewHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
