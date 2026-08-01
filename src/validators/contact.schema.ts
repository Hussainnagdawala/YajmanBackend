import { z } from "zod";
import { paginationSchema } from "./common.schema";

export const createContactSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().email().max(150).optional(),
  phone: z.string().regex(/^[6-9]\d{9}$/),
  city: z.string().trim().max(100).optional(),
  message: z.string().trim().optional(),
});

export const createServiceInquirySchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().email().max(150).optional(),
  phone: z.string().regex(/^[6-9]\d{9}$/),
  message: z.string().trim().optional(),
});

export const updateContactEntrySchema = z.object({
  is_read: z.coerce.boolean().optional(),
  status: z.enum(["new", "in_progress", "resolved", "closed"]).optional(),
  admin_notes: z.string().trim().optional(),
  assigned_to: z.string().uuid().optional(),
});

export const listContactEntriesQuerySchema = paginationSchema.extend({
  form_type: z.enum(["general", "service", "aayojan"]).optional(),
  status: z.enum(["new", "in_progress", "resolved", "closed"]).optional(),
});

export const createAayojanContactSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().email().max(150).optional(),
  phone: z.string().regex(/^[6-9]\d{9}$/),
  city: z.string().trim().max(100).optional(),
  event_name: z.string().trim().max(200).optional(),
  number_of_people: z.coerce.number().int().positive().optional(),
  preferred_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
