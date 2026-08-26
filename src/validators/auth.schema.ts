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
});

export const refreshTokenSchema = z.object({
  refresh_token: z.string().min(1, "Refresh token is required"),
});
