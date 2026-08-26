import { z } from "zod";

export const phoneSchema = z
  .string()
  .regex(/^[6-9]\d{9}$/, "Phone must be a valid 10-digit Indian mobile number");

export const countryCodeSchema = z.preprocess(
  (val) => {
    if (val === undefined || val === null || val === "") return "+91";
    if (typeof val === "string") {
      const trimmed = val.trim();
      if (/^\+\d{1,4}$/.test(trimmed)) return trimmed;
      if (/^\d{1,4}$/.test(trimmed)) return `+${trimmed}`;
    }
    return val;
  },
  z.string().regex(/^\+\d{1,4}$/, "Country code must start with + followed by digits")
);

export const uuidSchema = z.string().uuid("Must be a valid ID");

export const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be a valid date in YYYY-MM-DD format (e.g. 2026-08-15)");

export const timeStringSchema = z
  .string()
  .regex(/^\d{2}:\d{2}$/, "Must be a valid time in HH:MM format (e.g. 09:30)");

export const optionalPriceSchema = z.coerce
  .number({ invalid_type_error: "Price must be a valid number" })
  .nonnegative("Price cannot be negative")
  .optional();

export const optionalOriginalPriceSchema = z.coerce
  .number({ invalid_type_error: "Original price must be a valid number" })
  .positive("Original price must be greater than zero")
  .optional();

// z.coerce.boolean() is broken for query strings and multipart form fields —
// it's just JS `Boolean(x)`, so the STRING "false" (a non-empty string) coerces
// to `true`. Only real JS `false`/`undefined`/`""` coerce to `false`, which
// req.query/multipart bodies never produce (everything arrives as a string).
// This parses the actual string value instead.
export const strictBoolean = z.preprocess((val) => {
  if (typeof val === "boolean") return val;
  if (typeof val === "string") return val.toLowerCase() === "true" || val === "1";
  return val;
}, z.boolean());

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
});
