import { z } from "zod";

export const phoneSchema = z
  .string()
  .regex(/^[6-9]\d{9}$/, "Phone must be a valid 10-digit Indian mobile number");

export const countryCodeSchema = z.string().regex(/^\+\d{1,4}$/).default("+91");

export const uuidSchema = z.string().uuid();

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
