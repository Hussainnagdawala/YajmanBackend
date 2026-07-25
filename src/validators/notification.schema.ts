import { z } from "zod";
import { paginationSchema } from "./common.schema";

const uuidArrayFromInput = z.preprocess((val) => {
  if (val === undefined || val === null || val === "") return undefined;
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // fall through to comma-separated
    }
    return val.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return val;
}, z.array(z.string().uuid()).optional());

export const createCampaignSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    message: z.string().trim().min(1),
    type: z.string().trim().min(1).max(50).default("promo"),
    target_type: z.enum(["all", "selected"]).default("all"),
    target_user_ids: uuidArrayFromInput,
    deep_link: z.string().trim().max(500).optional().nullable(),
    action_type: z.string().trim().max(50).optional().nullable(),
    action_value: z.string().trim().max(500).optional().nullable(),
    scheduled_at: z.coerce.date().optional().nullable(),
    image_url: z.string().url().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.target_type === "selected" && (!data.target_user_ids || data.target_user_ids.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "target_user_ids is required when target_type is selected",
        path: ["target_user_ids"],
      });
    }
    if (data.scheduled_at && data.scheduled_at.getTime() <= Date.now()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "scheduled_at must be in the future",
        path: ["scheduled_at"],
      });
    }
  });

export const updateCampaignSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    message: z.string().trim().min(1).optional(),
    type: z.string().trim().min(1).max(50).optional(),
    target_type: z.enum(["all", "selected"]).optional(),
    target_user_ids: uuidArrayFromInput,
    deep_link: z.string().trim().max(500).optional().nullable(),
    action_type: z.string().trim().max(50).optional().nullable(),
    action_value: z.string().trim().max(500).optional().nullable(),
    scheduled_at: z.coerce.date().optional().nullable(),
    image_url: z.string().url().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.target_type === "selected" && data.target_user_ids !== undefined && data.target_user_ids.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "target_user_ids cannot be empty when target_type is selected",
        path: ["target_user_ids"],
      });
    }
    if (data.scheduled_at && data.scheduled_at.getTime() <= Date.now()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "scheduled_at must be in the future",
        path: ["scheduled_at"],
      });
    }
  });

export const listCampaignsQuerySchema = paginationSchema.extend({
  status: z
    .enum(["draft", "scheduled", "sending", "sent", "cancelled", "failed"])
    .optional(),
  target_type: z.enum(["all", "selected", "group", "topic"]).optional(),
  sort: z.enum(["created_at", "sent_at", "scheduled_at", "title"]).default("created_at"),
  order: z.enum(["asc", "desc"]).default("desc"),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const listRecipientsQuerySchema = paginationSchema;

export const listInboxQuerySchema = paginationSchema.extend({
  unread_only: z
    .preprocess((val) => {
      if (val === "true" || val === true) return true;
      if (val === "false" || val === false) return false;
      return undefined;
    }, z.boolean().optional()),
});
