import { z } from "zod";
import { paginationSchema } from "./common.schema";

// NOTE: update schemas are independent objects, not createXSchema.partial() —
// .partial() only makes keys optional, it does not strip inner .default(...),
// which would silently reset omitted fields on every PATCH. See service.schema.ts
// and README for the bug this pattern already caused twice in this codebase.

export const createBlogCategorySchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().optional(),
  display_order: z.coerce.number().int().default(0),
});
export const updateBlogCategorySchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().optional(),
  display_order: z.coerce.number().int().optional(),
  is_active: z.coerce.boolean().optional(),
});

export const createBlogAuthorSchema = z.object({
  name: z.string().trim().min(1).max(100),
  bio: z.string().trim().optional(),
  user_id: z.string().uuid().optional(),
});
export const updateBlogAuthorSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  bio: z.string().trim().optional(),
  user_id: z.string().uuid().optional(),
});

const jsonPreprocess = (val: unknown) => {
  if (typeof val === "string") {
    if (val.trim() === "") return [];
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  }
  return val;
};
const uuidArrayDefaulted = () => z.preprocess(jsonPreprocess, z.array(z.string().uuid()).default([]));
const uuidArrayOptional = () => z.preprocess(jsonPreprocess, z.array(z.string().uuid()).optional());

const BLOG_STATUSES = ["draft", "published", "archived"] as const;

export const createBlogSchema = z.object({
  title: z.string().trim().min(1).max(300),
  category_id: z.string().uuid().optional(),
  author_id: z.string().uuid().optional(),
  excerpt: z.string().trim().optional(),
  content: z.string().min(1),
  is_featured: z.coerce.boolean().default(false),
  status: z.enum(BLOG_STATUSES).default("draft"),
  published_at: z.coerce.date().optional(),
  recommended_blog_ids: uuidArrayDefaulted(),
  meta_title: z.string().trim().max(200).optional(),
  meta_description: z.string().trim().optional(),
});

export const updateBlogSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  category_id: z.string().uuid().optional(),
  author_id: z.string().uuid().optional(),
  excerpt: z.string().trim().optional(),
  content: z.string().min(1).optional(),
  is_featured: z.coerce.boolean().optional(),
  status: z.enum(BLOG_STATUSES).optional(),
  published_at: z.coerce.date().optional(),
  recommended_blog_ids: uuidArrayOptional(),
  meta_title: z.string().trim().max(200).optional(),
  meta_description: z.string().trim().optional(),
});

export const listBlogsQuerySchema = paginationSchema.extend({
  category: z.string().optional(),
  featured: z.coerce.boolean().optional(),
});
