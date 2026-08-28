import { z } from "zod";
import { paginationSchema, strictBoolean, dateStringSchema, optionalPriceSchema, optionalOriginalPriceSchema } from "./common.schema";

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
  question: z.string().trim().min(1, "Question is required"),
  answer: z.string().trim().min(1, "Answer is required"),
});

const servicePricingRefine = (data: { price?: number; original_price?: number }, ctx: z.RefinementCtx) => {
  if (
    data.original_price != null &&
    data.original_price > 0 &&
    data.price != null &&
    data.original_price <= data.price
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["original_price"],
      message: "Original price must be greater than the selling price to show a discount",
    });
  }
};

const serviceAvailabilityRefine = (
  data: {
    booking_availability_type?: "all_day" | "specific_day";
    availability_start_date?: string;
    availability_end_date?: string;
    available_dates?: string[];
  },
  ctx: z.RefinementCtx,
  mode: "create" | "update"
) => {
  const bookingType = data.booking_availability_type ?? "all_day";

  if (bookingType === "specific_day") {
    const dates = data.available_dates;
    const hasDates = Array.isArray(dates) && dates.length > 0;
    if (mode === "create" && !hasDates) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["available_dates"],
        message: "At least one available date is required when booking type is 'Specific days'",
      });
    }
    if (mode === "update" && data.available_dates !== undefined && !hasDates) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["available_dates"],
        message: "At least one available date is required when booking type is 'Specific days'",
      });
    }
  }

  // all_day: start/end dates and available_dates are all optional — no extra checks.

  if (data.availability_start_date && data.availability_end_date) {
    if (data.availability_end_date < data.availability_start_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["availability_end_date"],
        message: "Availability end date must be on or after the start date",
      });
    }
  }
};

// The admin form has sent `is_best_seller` (two words) while the schema/DB
// column has always been `is_bestseller` (one word) — zod silently drops
// unrecognized keys, so that field was a no-op: the toggle appeared to save
// but never actually changed anything. Accept both spellings until the form
// itself is fixed.
const aliasBestSeller = (val: unknown) => {
  if (val && typeof val === "object" && "is_best_seller" in val && !("is_bestseller" in (val as object))) {
    const { is_best_seller, ...rest } = val as Record<string, unknown>;
    return { ...rest, is_bestseller: is_best_seller };
  }
  return val;
};

export const createServiceSchema = z.preprocess(
  aliasBestSeller,
  z
    .object({
  title: z.string().trim().min(1, "Title is required").max(200, "Title must be at most 200 characters"),
  category_id: z.string().uuid("Category must be a valid ID"),
  type_ids: jsonArrayDefaulted(z.string().uuid("Each type must be a valid ID")),
  tag_ids: jsonArrayDefaulted(z.string().uuid("Each tag must be a valid ID")),
  temple_ids: jsonArrayDefaulted(z.string().uuid("Each temple must be a valid ID")),
  addon_ids: jsonArrayDefaulted(z.string().uuid("Each add-on must be a valid ID")),
  is_addon_available: strictBoolean.default(false),
  benefits: jsonArrayDefaulted(z.string().trim().min(1, "Benefit cannot be empty")),
  price: blankToUndefined(optionalPriceSchema),
  original_price: blankToUndefined(optionalOriginalPriceSchema),
  short_description: z.string().trim().optional(),
  about_puja: z.string().trim().optional(),
  description: z.string().trim().optional(),
  custom_content: z.string().optional(),
  pincode: z.string().trim().max(10, "Pincode must be at most 10 characters").optional(),
  latitude: blankToUndefined(z.coerce.number({ invalid_type_error: "Latitude must be a valid number" }).optional()),
  longitude: blankToUndefined(z.coerce.number({ invalid_type_error: "Longitude must be a valid number" }).optional()),
  video_url: z.string().trim().optional(),
  duration_minutes: blankToUndefined(
    z.coerce.number({ invalid_type_error: "Duration must be a valid number" }).int("Duration must be a whole number").positive("Duration must be greater than zero").optional()
  ),
  advance_booking_days: blankToUndefined(
    z.coerce.number({ invalid_type_error: "Advance booking days must be a valid number" }).int("Advance booking days must be a whole number").nonnegative("Advance booking days cannot be negative").default(0)
  ),
  availability_start_date: blankToUndefined(dateStringSchema.optional()),
  availability_end_date: blankToUndefined(dateStringSchema.optional()),
  booking_availability_type: blankToUndefined(z.enum(["all_day", "specific_day"]).default("all_day")),
  available_dates: jsonArrayDefaulted(dateStringSchema),
  is_featured: strictBoolean.default(false),
  is_bestseller: strictBoolean.default(false),
  display_order: z.coerce
    .number({ invalid_type_error: "Display order must be a valid number" })
    .int("Display order must be a whole number")
    .nonnegative("Display order cannot be negative"),
  meta_title: z.string().trim().max(200, "Meta title must be at most 200 characters").optional(),
  meta_description: z.string().trim().optional(),
  key_features: jsonArrayDefaulted(z.string().trim().min(1, "Key feature cannot be empty")),
  packages: jsonArrayDefaulted(packageSchema),
  faqs: jsonArrayDefaulted(faqSchema),
  puja_process_id: blankToUndefined(z.string().uuid("Puja process must be a valid ID").optional()),
  })
    .superRefine((data, ctx) => {
      servicePricingRefine(data, ctx);
      serviceAvailabilityRefine(data, ctx, "create");
    })
);

// Independent schema (not createServiceSchema.partial()) — partial() only makes
// keys optional, it does not strip the .default()s above, which would otherwise
// silently reset advance_booking_days/is_featured/is_bestseller/display_order/
// every array field to their create-time defaults on every partial PATCH.
export const updateServiceSchema = z.preprocess(
  aliasBestSeller,
  z
    .object({
  title: z.string().trim().min(1, "Title is required").max(200, "Title must be at most 200 characters").optional(),
  category_id: z.string().uuid("Category must be a valid ID").optional(),
  type_ids: jsonArrayOptional(z.string().uuid("Each type must be a valid ID")),
  tag_ids: jsonArrayOptional(z.string().uuid("Each tag must be a valid ID")),
  temple_ids: jsonArrayOptional(z.string().uuid("Each temple must be a valid ID")),
  addon_ids: jsonArrayOptional(z.string().uuid("Each add-on must be a valid ID")),
  is_addon_available: strictBoolean.optional(),
  benefits: jsonArrayOptional(z.string().trim().min(1, "Benefit cannot be empty")),
  price: blankToUndefined(optionalPriceSchema),
  original_price: blankToUndefined(optionalOriginalPriceSchema),
  short_description: z.string().trim().optional(),
  about_puja: z.string().trim().optional(),
  description: z.string().trim().optional(),
  custom_content: z.string().optional(),
  pincode: z.string().trim().max(10, "Pincode must be at most 10 characters").optional(),
  latitude: blankToUndefined(z.coerce.number({ invalid_type_error: "Latitude must be a valid number" }).optional()),
  longitude: blankToUndefined(z.coerce.number({ invalid_type_error: "Longitude must be a valid number" }).optional()),
  video_url: z.string().trim().optional(),
  duration_minutes: blankToUndefined(
    z.coerce.number({ invalid_type_error: "Duration must be a valid number" }).int("Duration must be a whole number").positive("Duration must be greater than zero").optional()
  ),
  advance_booking_days: blankToUndefined(
    z.coerce.number({ invalid_type_error: "Advance booking days must be a valid number" }).int("Advance booking days must be a whole number").nonnegative("Advance booking days cannot be negative").optional()
  ),
  availability_start_date: blankToUndefined(dateStringSchema.optional()),
  availability_end_date: blankToUndefined(dateStringSchema.optional()),
  booking_availability_type: blankToUndefined(z.enum(["all_day", "specific_day"]).optional()),
  available_dates: jsonArrayOptional(dateStringSchema),
  is_featured: strictBoolean.optional(),
  is_bestseller: strictBoolean.optional(),
  is_active: strictBoolean.optional(),
  display_order: z.coerce
    .number({ invalid_type_error: "Display order must be a valid number" })
    .int("Display order must be a whole number")
    .nonnegative("Display order cannot be negative")
    .optional(),
  meta_title: z.string().trim().max(200, "Meta title must be at most 200 characters").optional(),
  meta_description: z.string().trim().optional(),
  key_features: jsonArrayOptional(z.string().trim().min(1, "Key feature cannot be empty")),
  packages: jsonArrayOptional(packageSchema),
  faqs: jsonArrayOptional(faqSchema),
  puja_process_id: z.preprocess(
    (val) => (val === "" ? null : val),
    z.string().uuid("Puja process must be a valid ID").nullable().optional()
  ),
  })
    .superRefine((data, ctx) => {
      servicePricingRefine(data, ctx);
      serviceAvailabilityRefine(data, ctx, "update");
    })
);

export const listServicesQuerySchema = paginationSchema.extend({
  category: z.string().optional(),
  type: z.string().optional(),
  tag: z.string().optional(),
  min_price: z.coerce.number().nonnegative().optional(),
  max_price: z.coerce.number().nonnegative().optional(),
  rating: z.coerce.number().min(0).max(5).optional(),
  sort: z.enum(["display_order", "display_order_desc", "price_asc", "price_desc", "rating", "newest", "title"]).optional(),
  is_featured: strictBoolean.optional(),
  is_bestseller: strictBoolean.optional(),
  requires_pandit: strictBoolean.optional(),
  requires_payment: strictBoolean.optional(),
});

export const listTrendingQuerySchema = paginationSchema;

export const listServicesAdminQuerySchema = paginationSchema.extend({
  category_id: z.string().uuid().optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  is_active: strictBoolean.optional(),
  sort: z.enum(["display_order", "display_order_desc", "price_asc", "price_desc", "newest", "title"]).optional(),
  requires_pandit: strictBoolean.optional(),
  requires_payment: strictBoolean.optional(),
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
