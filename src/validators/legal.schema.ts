import { z } from "zod";

export const createLegalPageSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  content: z.string().optional().default(""),
  meta_title: z.string().trim().max(200).optional().nullable(),
  meta_description: z.string().trim().optional().nullable(),
  is_active: z.coerce.boolean().default(true),
});

export const updateLegalPageSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200).optional(),
  content: z.string().optional(),
  meta_title: z.string().trim().max(200).optional().nullable(),
  meta_description: z.string().trim().optional().nullable(),
  is_active: z.coerce.boolean().optional(),
});
