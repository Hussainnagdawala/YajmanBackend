import { z } from "zod";

export const registerDeviceTokenSchema = z.object({
  token: z.string().trim().min(1),
  platform: z.enum(["web", "android", "ios"]),
  device_info: z.record(z.string(), z.unknown()).optional(),
});

export const removeDeviceTokenSchema = z.object({
  token: z.string().trim().min(1),
});
