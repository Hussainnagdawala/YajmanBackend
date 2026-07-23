import { z } from "zod";
import { paginationSchema } from "./common.schema";

const jsonPreprocess = (val: unknown) => {
  if (typeof val === "string") {
    if (val.trim() === "") return [];
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  }
  return val;
};
const stringArrayOptional = () => z.preprocess(jsonPreprocess, z.array(z.string()).optional());

export const updatePanditProfileSchema = z.object({
  display_name: z.string().trim().min(1).max(100).optional(),
  bio: z.string().trim().optional(),
  experience_years: z.coerce.number().int().nonnegative().optional(),
  specializations: stringArrayOptional(),
  languages: stringArrayOptional(),
  service_areas: stringArrayOptional(),
  is_available: z.coerce.boolean().optional(),
});

export const assignPanditSchema = z.object({
  order_id: z.string().uuid(),
  pandit_id: z.string().uuid(),
});

export const reassignPanditSchema = z.object({
  pandit_id: z.string().uuid(),
});

export const acceptAssignmentSchema = z.object({
  notes: z.string().trim().max(1000).optional(),
});

export const rejectAssignmentSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
});

export const listAssignmentsQuerySchema = paginationSchema.extend({
  status: z.enum(["pending", "accepted", "rejected", "expired", "completed"]).optional(),
});

export const listAdminAssignmentsQuerySchema = listAssignmentsQuerySchema.extend({
  expiring: z.coerce.boolean().optional(),
});

export const listPanditBookingsQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
