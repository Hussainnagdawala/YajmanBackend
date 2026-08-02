import { z } from "zod";

// NOTE: update schemas below are independent objects, not createXSchema.partial().
// .partial() only makes keys optional — it does not strip inner .default(...),
// so a PATCH omitting e.g. display_order would still have it default back to 0.
// (Same bug class as updateServiceSchema — see service.schema.ts and README.)

export const createPopularSearchSchema = z.object({
  label: z.string().trim().min(1).max(100),
  link_url: z.string().trim().max(500).optional(),
  display_order: z.coerce.number().int().default(0),
  row_number: z.coerce.number().int().min(1).max(2).default(1),
});
export const updatePopularSearchSchema = z.object({
  label: z.string().trim().min(1).max(100).optional(),
  link_url: z.string().trim().max(500).optional(),
  display_order: z.coerce.number().int().optional(),
  row_number: z.coerce.number().int().min(1).max(2).optional(),
  is_active: z.coerce.boolean().optional(),
});

const BANNER_POSITIONS = [
  "hero_slider",
  "middle_ad",
  "offer_banner",
  "category_banner",
] as const;

/** Public app query: filter by banner type (maps to DB `position`). */
export const listBannersQuerySchema = z
  .object({
    type: z.enum(BANNER_POSITIONS).optional(),
    position: z.enum(BANNER_POSITIONS).optional(),
  })
  .refine((data) => data.type || data.position, {
    message: "type (or position) is required: hero_slider | middle_ad | offer_banner | category_banner",
    path: ["type"],
  })
  .transform((data) => ({
    type: (data.type ?? data.position) as (typeof BANNER_POSITIONS)[number],
  }));

export const createBannerSchema = z.object({
  title: z.string().trim().max(200).optional(),
  subtitle: z.string().trim().optional(),
  description: z.string().trim().optional(),
  link_url: z.string().trim().max(500).optional(),
  cta_text: z.string().trim().max(50).optional(),
  position: z.enum(BANNER_POSITIONS),
  discount_text: z.string().trim().max(50).optional(),
  bg_color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  text_color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  display_order: z.coerce.number().int().default(0),
  starts_at: z.coerce.date().optional(),
  ends_at: z.coerce.date().optional(),
});
export const updateBannerSchema = z.object({
  title: z.string().trim().max(200).optional(),
  subtitle: z.string().trim().optional(),
  description: z.string().trim().optional(),
  link_url: z.string().trim().max(500).optional(),
  cta_text: z.string().trim().max(50).optional(),
  position: z.enum(BANNER_POSITIONS).optional(),
  discount_text: z.string().trim().max(50).optional(),
  bg_color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  text_color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  display_order: z.coerce.number().int().optional(),
  starts_at: z.coerce.date().optional(),
  ends_at: z.coerce.date().optional(),
  is_active: z.coerce.boolean().optional(),
});

export const listTestimonialsQuerySchema = z.object({
  page: z.enum(["home", "aayojan"]).optional(),
});

export const createTestimonialSchema = z.object({
  author_name: z.string().trim().min(1).max(100),
  author_designation: z.string().trim().max(100).optional(),
  quote: z.string().trim().min(1),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  page: z.enum(["home", "aayojan"]).default("home"),
  display_order: z.coerce.number().int().default(0),
});
export const updateTestimonialSchema = z.object({
  author_name: z.string().trim().min(1).max(100).optional(),
  author_designation: z.string().trim().max(100).optional(),
  quote: z.string().trim().min(1).optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  page: z.enum(["home", "aayojan"]).optional(),
  display_order: z.coerce.number().int().optional(),
  is_active: z.coerce.boolean().optional(),
});

export const createRecommendedServiceSchema = z.object({
  service_id: z.string().uuid(),
  page: z.string().trim().min(1).max(50).default("home"),
  section: z.string().trim().min(1).max(50).default("recommended"),
  display_order: z.coerce.number().int().default(0),
});
export const updateRecommendedServiceSchema = z.object({
  service_id: z.string().uuid().optional(),
  page: z.string().trim().min(1).max(50).optional(),
  section: z.string().trim().min(1).max(50).optional(),
  display_order: z.coerce.number().int().optional(),
  is_active: z.coerce.boolean().optional(),
});
