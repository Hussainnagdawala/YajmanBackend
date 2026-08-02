import { z } from "zod";
import { paginationSchema } from "./common.schema";

const jsonPreprocess = (val: unknown) => {
  if (typeof val === "string") {
    if (val.trim() === "") return [];
    try {
      return JSON.parse(val);
    } catch {
      // Not JSON — a single plain value sent as one form field (e.g.
      // type_ids: "<uuid>" instead of type_ids: '["<uuid>"]'). Treat it as
      // a one-item array instead of failing with "Expected array, received string".
      return [val];
    }
  }
  return val;
};

// Always resolves to an array (missing/absent -> []). Only safe for CREATE,
// where "not sent" and "empty" are meant to be the same thing.
const jsonArrayDefaulted = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(jsonPreprocess, z.array(schema).default([]));

// Stays undefined when absent, so PATCH can tell "not sent" (leave alone)
// apart from "sent as []" (clear it) — no default() means .partial() can't leak one in.
const jsonArrayOptional = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(jsonPreprocess, z.array(schema).optional());

// multipart/form-data sends every field as a string — a blank input arrives as
// "" (present key, empty value), never as an absent key. `.optional()`/`.default()`
// only trigger on `undefined`, so an untouched optional date/number field still
// hits its regex/coerce check and fails as "Invalid" instead of being treated as
// not-sent. Pass the FULLY formed schema (including its own trailing .optional()
// or .default(x)) — this only normalizes "" -> undefined before that runs, it
// doesn't add optionality itself (order matters: default() must see the
// already-converted undefined, not the raw "").
const blankToUndefined = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((val) => (val === "" ? undefined : val), schema);

const packageItemSchema = z.object({
  name: z.string().trim().min(1),
  quantity: z.union([z.string(), z.number()]).optional(),
  unit: z.string().trim().optional(),
});

const packageSchema = z.object({
  title: z.string().trim().min(1).max(150),
  description: z.string().trim().optional(),
  items: z.array(packageItemSchema).optional().default([]),
  price: z.coerce.number().nonnegative().optional(),
});

const faqSchema = z.object({
  question: z.string().trim().min(1),
  answer: z.string().trim().min(1),
});

export const createServiceSchema = z.object({
  title: z.string().trim().min(1).max(200),
  category_id: z.string().uuid(),
  type_ids: jsonArrayDefaulted(z.string().uuid()),
  tag_ids: jsonArrayDefaulted(z.string().uuid()),
  temple_ids: jsonArrayDefaulted(z.string().uuid()),
  addon_ids: jsonArrayDefaulted(z.string().uuid()),
  is_addon_available: z.coerce.boolean().default(false),
  benefits: jsonArrayDefaulted(z.string().trim().min(1)),
  price: blankToUndefined(z.coerce.number().nonnegative().optional()),
  original_price: blankToUndefined(z.coerce.number().positive().optional()),
  short_description: z.string().trim().optional(),
  about_puja: z.string().trim().optional(),
  description: z.string().trim().optional(),
  custom_content: z.string().optional(),
  pincode: z.string().trim().max(10).optional(),
  latitude: blankToUndefined(z.coerce.number().optional()),
  longitude: blankToUndefined(z.coerce.number().optional()),
  video_url: z.string().trim().optional(),
  duration_minutes: blankToUndefined(z.coerce.number().int().positive().optional()),
  advance_booking_days: blankToUndefined(z.coerce.number().int().nonnegative().default(0)),
  availability_start_date: blankToUndefined(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  availability_end_date: blankToUndefined(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  booking_availability_type: blankToUndefined(z.enum(["all_day", "specific_day"]).default("all_day")),
  available_dates: jsonArrayDefaulted(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  is_featured: z.coerce.boolean().default(false),
  is_bestseller: z.coerce.boolean().default(false),
  display_order: z.coerce.number().int().default(0),
  meta_title: z.string().trim().max(200).optional(),
  meta_description: z.string().trim().optional(),
  key_features: jsonArrayDefaulted(z.string().trim().min(1)),
  packages: jsonArrayDefaulted(packageSchema),
  faqs: jsonArrayDefaulted(faqSchema),
});

// Independent schema (not createServiceSchema.partial()) — partial() only makes
// keys optional, it does not strip the .default()s above, which would otherwise
// silently reset advance_booking_days/is_featured/is_bestseller/display_order/
// every array field to their create-time defaults on every partial PATCH.
export const updateServiceSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  category_id: z.string().uuid().optional(),
  type_ids: jsonArrayOptional(z.string().uuid()),
  tag_ids: jsonArrayOptional(z.string().uuid()),
  temple_ids: jsonArrayOptional(z.string().uuid()),
  addon_ids: jsonArrayOptional(z.string().uuid()),
  is_addon_available: z.coerce.boolean().optional(),
  benefits: jsonArrayOptional(z.string().trim().min(1)),
  price: blankToUndefined(z.coerce.number().nonnegative().optional()),
  original_price: blankToUndefined(z.coerce.number().positive().optional()),
  short_description: z.string().trim().optional(),
  about_puja: z.string().trim().optional(),
  description: z.string().trim().optional(),
  custom_content: z.string().optional(),
  pincode: z.string().trim().max(10).optional(),
  latitude: blankToUndefined(z.coerce.number().optional()),
  longitude: blankToUndefined(z.coerce.number().optional()),
  video_url: z.string().trim().optional(),
  duration_minutes: blankToUndefined(z.coerce.number().int().positive().optional()),
  advance_booking_days: blankToUndefined(z.coerce.number().int().nonnegative().optional()),
  availability_start_date: blankToUndefined(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  availability_end_date: blankToUndefined(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  booking_availability_type: blankToUndefined(z.enum(["all_day", "specific_day"]).optional()),
  available_dates: jsonArrayOptional(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  is_featured: z.coerce.boolean().optional(),
  is_bestseller: z.coerce.boolean().optional(),
  is_active: z.coerce.boolean().optional(),
  display_order: z.coerce.number().int().optional(),
  meta_title: z.string().trim().max(200).optional(),
  meta_description: z.string().trim().optional(),
  key_features: jsonArrayOptional(z.string().trim().min(1)),
  packages: jsonArrayOptional(packageSchema),
  faqs: jsonArrayOptional(faqSchema),
});

export const listServicesQuerySchema = paginationSchema.extend({
  category: z.string().optional(),
  type: z.string().optional(),
  tag: z.string().optional(),
  min_price: z.coerce.number().nonnegative().optional(),
  max_price: z.coerce.number().nonnegative().optional(),
  rating: z.coerce.number().min(0).max(5).optional(),
  sort: z.enum(["price_asc", "price_desc", "rating", "newest", "title"]).optional(),
  is_featured: z.coerce.boolean().optional(),
  is_bestseller: z.coerce.boolean().optional(),
});

export const listTrendingQuerySchema = paginationSchema;

export const listServicesAdminQuerySchema = paginationSchema.extend({
  category_id: z.string().uuid().optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  is_active: z.coerce.boolean().optional(),
  sort: z.enum(["price_asc", "price_desc", "newest", "title"]).optional(),
});

export const createTempleSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().optional(),
  address: z.string().trim().optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
});

export const updateTempleSchema = createTempleSchema.partial().extend({
  is_active: z.coerce.boolean().optional(),
});
