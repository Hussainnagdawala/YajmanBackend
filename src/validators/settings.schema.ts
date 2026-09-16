import { z } from "zod";
import { SETTING_CATEGORIES } from "../constants/settings.catalog";

export const listSettingsQuerySchema = z.object({
  category: z.enum(SETTING_CATEGORIES as [string, ...string[]]).optional(),
});

export const settingKeyParamSchema = z.object({
  key: z.string().trim().min(1).max(100),
});

export const bulkUpdateSettingsSchema = z
  .object({
    settings: z.record(z.string(), z.unknown()).optional(),
    categories: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
  })
  .superRefine((data, ctx) => {
    const hasSettings = data.settings && Object.keys(data.settings).length > 0;
    const hasCategories = data.categories && Object.keys(data.categories).length > 0;
    if (!hasSettings && !hasCategories) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide settings (flat key map) or categories",
      });
    }
  });

export const patchSettingSchema = z.object({
  value: z.unknown(),
});

export const publicSettingsQuerySchema = z.object({
  platform: z.enum(["android", "ios"]).optional(),
  app_version: z.string().trim().min(1).max(30).optional(),
});
