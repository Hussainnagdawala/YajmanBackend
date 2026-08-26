import { z } from "zod";
import {
  dateStringSchema,
  timeStringSchema,
  optionalPriceSchema,
  optionalOriginalPriceSchema,
} from "./common.schema";

const blankToUndefined = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((val) => (val === "" ? undefined : val), schema);

const aayojanPricingRefine = (data: { price?: number; original_price?: number }, ctx: z.RefinementCtx) => {
  if (data.original_price != null && data.price != null && data.original_price <= data.price) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["original_price"],
      message: "Original price must be greater than the selling price to show a discount",
    });
  }
};

// NOTE: update schemas are independent objects, not createXSchema.partial() —
// see service.schema.ts / README for why that pattern silently resets omitted
// fields back to their create-time defaults on every PATCH.

export const createAayojanContentSchema = z.object({
  section_key: z.string().trim().min(1, "Section key is required").max(50, "Section key must be at most 50 characters"),
  title: z.string().trim().max(200, "Title must be at most 200 characters").optional(),
  subtitle: z.string().trim().optional(),
  description: z.string().trim().optional(),
  cta_text: z.string().trim().max(100, "Call-to-action text must be at most 100 characters").optional(),
  cta_link: z.string().trim().max(500, "Call-to-action link must be at most 500 characters").optional(),
  display_order: z.coerce.number().int().default(0),
});
export const updateAayojanContentSchema = z.object({
  section_key: z.string().trim().min(1, "Section key is required").max(50, "Section key must be at most 50 characters").optional(),
  title: z.string().trim().max(200, "Title must be at most 200 characters").optional(),
  subtitle: z.string().trim().optional(),
  description: z.string().trim().optional(),
  cta_text: z.string().trim().max(100, "Call-to-action text must be at most 100 characters").optional(),
  cta_link: z.string().trim().max(500, "Call-to-action link must be at most 500 characters").optional(),
  display_order: z.coerce.number().int().optional(),
  is_active: z.coerce.boolean().optional(),
});

export const createAayojanEventSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(200, "Title must be at most 200 characters"),
    description: z.string().trim().optional(),
    short_description: z.string().trim().optional(),
    location: z.string().trim().max(200, "Location must be at most 200 characters").optional(),
    city: z.string().trim().max(100, "City must be at most 100 characters").optional(),
    event_date: blankToUndefined(dateStringSchema.optional()),
    event_time: blankToUndefined(timeStringSchema.optional()),
    price: blankToUndefined(optionalPriceSchema),
    original_price: blankToUndefined(optionalOriginalPriceSchema),
    max_capacity: blankToUndefined(
      z.coerce
        .number({ invalid_type_error: "Maximum capacity must be a valid number" })
        .int("Maximum capacity must be a whole number")
        .positive("Maximum capacity must be greater than zero")
        .optional()
    ),
    status: z.enum(["draft", "published", "archived"]).default("published"),
  })
  .superRefine(aayojanPricingRefine);

export const updateAayojanEventSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(200, "Title must be at most 200 characters").optional(),
    description: z.string().trim().optional(),
    short_description: z.string().trim().optional(),
    location: z.string().trim().max(200, "Location must be at most 200 characters").optional(),
    city: z.string().trim().max(100, "City must be at most 100 characters").optional(),
    event_date: blankToUndefined(dateStringSchema.optional()),
    event_time: blankToUndefined(timeStringSchema.optional()),
    price: blankToUndefined(optionalPriceSchema),
    original_price: blankToUndefined(optionalOriginalPriceSchema),
    max_capacity: blankToUndefined(
      z.coerce
        .number({ invalid_type_error: "Maximum capacity must be a valid number" })
        .int("Maximum capacity must be a whole number")
        .positive("Maximum capacity must be greater than zero")
        .optional()
    ),
    status: z.enum(["draft", "published", "archived"]).optional(),
    is_active: z.coerce.boolean().optional(),
  })
  .superRefine(aayojanPricingRefine);

export const createAayojanBannerSchema = z.object({
  title: z.string().trim().max(200, "Title must be at most 200 characters").optional(),
  link_url: z.string().trim().max(500, "Link URL must be at most 500 characters").optional(),
  display_order: z.coerce.number().int().default(0),
});
export const updateAayojanBannerSchema = z.object({
  title: z.string().trim().max(200, "Title must be at most 200 characters").optional(),
  link_url: z.string().trim().max(500, "Link URL must be at most 500 characters").optional(),
  display_order: z.coerce.number().int().optional(),
  is_active: z.coerce.boolean().optional(),
});
