import { z } from "zod";
import { paginationSchema } from "./common.schema";

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  email: z.string().email().max(150).optional(),
  whatsapp_number: z.string().regex(/^[6-9]\d{9}$/).optional(),
  calling_number: z.string().regex(/^[6-9]\d{9}$/).optional(),
  gender: z.enum(["Male", "Female", "Other"]).optional(),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  time_of_birth: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  place_of_birth: z.string().trim().max(150).optional(),
});

export const createUserSchema = z.object({
  phone: z.string().regex(/^[6-9]\d{9}$/),
  name: z.string().trim().min(1).max(100),
  role: z.enum(["pandit", "admin", "customer"]).default("pandit"),
  email: z.string().email().max(150).optional(),
});

// Independent object, not createUserSchema.partial() — .partial() would leave
// role's .default("pandit") in place, silently resetting an admin/customer's
// role to "pandit" on any PATCH that omits it. See service.schema.ts for the
// same bug class caught during Step 5.
export const updateUserSchema = z.object({
  phone: z.string().regex(/^[6-9]\d{9}$/).optional(),
  name: z.string().trim().min(1).max(100).optional(),
  role: z.enum(["pandit", "admin", "customer"]).optional(),
  email: z.string().email().max(150).optional(),
});

export const updateUserStatusSchema = z.object({
  status: z.enum(["active", "inactive", "suspended"]),
});

export const listUsersQuerySchema = paginationSchema.extend({
  role: z.enum(["customer", "pandit", "admin"]).optional(),
  status: z.enum(["active", "inactive", "suspended"]).optional(),
});
