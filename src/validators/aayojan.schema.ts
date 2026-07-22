import { z } from "zod";

// NOTE: update schemas are independent objects, not createXSchema.partial() —
// see service.schema.ts / README for why that pattern silently resets omitted
// fields back to their create-time defaults on every PATCH.

export const createAayojanContentSchema = z.object({
  section_key: z.string().trim().min(1).max(50),
  title: z.string().trim().max(200).optional(),
  subtitle: z.string().trim().optional(),
  description: z.string().trim().optional(),
  cta_text: z.string().trim().max(100).optional(),
  cta_link: z.string().trim().max(500).optional(),
  display_order: z.coerce.number().int().default(0),
});
export const updateAayojanContentSchema = z.object({
  section_key: z.string().trim().min(1).max(50).optional(),
  title: z.string().trim().max(200).optional(),
  subtitle: z.string().trim().optional(),
  description: z.string().trim().optional(),
  cta_text: z.string().trim().max(100).optional(),
  cta_link: z.string().trim().max(500).optional(),
  display_order: z.coerce.number().int().optional(),
  is_active: z.coerce.boolean().optional(),
});

export const createAayojanEventSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().optional(),
  short_description: z.string().trim().optional(),
  location: z.string().trim().max(200).optional(),
  city: z.string().trim().max(100).optional(),
  event_date: z.coerce.date().optional(),
  event_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  price: z.coerce.number().nonnegative().optional(),
  original_price: z.coerce.number().nonnegative().optional(),
  max_capacity: z.coerce.number().int().positive().optional(),
  status: z.enum(["draft", "published", "archived"]).default("published"),
});
export const updateAayojanEventSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().optional(),
  short_description: z.string().trim().optional(),
  location: z.string().trim().max(200).optional(),
  city: z.string().trim().max(100).optional(),
  event_date: z.coerce.date().optional(),
  event_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  price: z.coerce.number().nonnegative().optional(),
  original_price: z.coerce.number().nonnegative().optional(),
  max_capacity: z.coerce.number().int().positive().optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  is_active: z.coerce.boolean().optional(),
});

export const createAayojanBannerSchema = z.object({
  title: z.string().trim().max(200).optional(),
  link_url: z.string().trim().max(500).optional(),
  display_order: z.coerce.number().int().default(0),
});
export const updateAayojanBannerSchema = z.object({
  title: z.string().trim().max(200).optional(),
  link_url: z.string().trim().max(500).optional(),
  display_order: z.coerce.number().int().optional(),
  is_active: z.coerce.boolean().optional(),
});
