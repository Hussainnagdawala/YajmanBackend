import { z } from "zod";
import { phoneSchema, countryCodeSchema } from "./common.schema";

export const sendOtpSchema = z.object({
  phone: phoneSchema,
  country_code: countryCodeSchema.optional(),
});

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  country_code: countryCodeSchema.optional(),
  otp: z.string().length(6, "OTP must be exactly 6 digits"),
  device_source: z.enum(["web", "app", "portal"], { errorMap: () => ({ message: "Device source must be web, app, or portal" }) }).default("web"),
  device_token: z
    .preprocess(
      (val) => (typeof val === "string" && val.trim() === "" ? undefined : val),
      z.string().trim().min(1).optional(),
    ),
  platform: z.union([
    z.enum(["app", "web"]),
    z.enum(["android", "ios", "web"]),
  ]).optional(),
  device_type: z.enum(["android", "ios", "browser"]).optional(),
  browser: z.string().trim().min(1).max(50).optional(),
});

export const logoutSchema = z.object({
  refresh_token: z.string().min(1).optional(),
  device_token: z
    .preprocess(
      (val) => (typeof val === "string" && val.trim() === "" ? undefined : val),
      z.string().trim().min(1).optional(),
    ),
});

export const refreshTokenSchema = z.object({
  refresh_token: z.string().min(1, "Refresh token is required"),
});
