import { z } from "zod";

const optionalTrimmedString = z.preprocess(
  (val) => (typeof val === "string" && val.trim() === "" ? undefined : val),
  z.string().trim().min(1).optional(),
);

export const notificationChannelSchema = z.enum(["app", "web"]);
export const deviceTypeSchema = z.enum(["android", "ios", "browser"]);
export const legacyFcmPlatformSchema = z.enum(["android", "ios", "web"]);

/** Accepts new channel (`app`|`web`), legacy FCM platform, or omitted. */
export const platformInputSchema = z
  .union([notificationChannelSchema, legacyFcmPlatformSchema])
  .optional();

export const deviceTokenFieldSchema = optionalTrimmedString;

export const registerDeviceTokenSchema = z
  .object({
    token: deviceTokenFieldSchema,
    device_token: deviceTokenFieldSchema,
    platform: platformInputSchema,
    device_type: deviceTypeSchema.optional(),
    browser: z.string().trim().min(1).max(50).optional(),
    device_info: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((data, ctx) => {
    const resolvedToken = data.device_token ?? data.token;
    if (!resolvedToken) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "device_token or token is required",
        path: ["device_token"],
      });
    }
  })
  .transform((data) => ({
    device_token: data.device_token ?? data.token!,
    platform: data.platform,
    device_type: data.device_type,
    browser: data.browser,
    device_info: data.device_info,
  }));

export const removeDeviceTokenSchema = z
  .object({
    token: deviceTokenFieldSchema,
    device_token: deviceTokenFieldSchema,
  })
  .superRefine((data, ctx) => {
    if (!data.device_token && !data.token) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "device_token or token is required",
        path: ["device_token"],
      });
    }
  })
  .transform((data) => ({
    device_token: (data.device_token ?? data.token) as string,
  }));
