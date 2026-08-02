import { Request, Response, NextFunction } from "express";
import DOMPurify from "isomorphic-dompurify";
import { pool } from "../config/database";
import { success } from "../utils/response";
import { AppError } from "../utils/errors";
import { paginate } from "../utils/pagination";
import { generateUniqueSlug } from "../services/slug.service";
import { deleteFromS3 } from "../services/upload.service";
import {
  listActiveBlogCategories,
  listAllBlogCategories,
  createBlogCategory as createBlogCategoryQuery,
  updateBlogCategory as updateBlogCategoryQuery,
  softDeleteBlogCategory,
  hardDeleteBlogCategory,
  countBlogsByCategory,
  listAllBlogAuthors,
  createBlogAuthor as createBlogAuthorQuery,
  updateBlogAuthor as updateBlogAuthorQuery,
  deleteBlogAuthor as deleteBlogAuthorQuery,
  createBlog as createBlogQuery,
  updateBlog as updateBlogQuery,
  findBlogById,
  findBlogByIdAdmin,
  softDeleteBlog,
  hardDeleteBlog,
  findBlogImageUrls,
  listBlogs as listBlogsQuery,
  countBlogs,
  listBlogsAdmin as listBlogsAdminQuery,
  countBlogsAdmin,
  findBlogBySlug,
  listSidebarServices,
  clearRecommendedBlogs,
  setRecommendedBlogs,
  insertBlogImage,
  maxBlogImageOrder,
} from "../queries/blog.queries";

type MulterS3Files = Record<string, Express.MulterS3.File[]>;
type MulterS3File = Express.MulterS3.File;

// ─── Public: blog categories ─────────────────────────────────

export const listBlogCategoriesPublic = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(listActiveBlogCategories);
    return success(res, result.rows);
  } catch (err) {
    next(err);
  }
};

// ─── Admin: blog categories ──────────────────────────────────

export const listBlogCategoriesAdmin = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(listAllBlogCategories);
    return success(res, result.rows);
  } catch (err) {
    next(err);
  }
};

export const createBlogCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description, display_order } = req.body;
    const slug = await generateUniqueSlug(name, "blogs");
    const result = await pool.query(createBlogCategoryQuery, [name, slug, description ?? null, display_order]);
    return success(res, result.rows[0], "Blog category created", 201);
  } catch (err) {
    next(err);
  }
};

export const updateBlogCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fields = Object.keys(req.body);
    if (fields.length === 0) throw new AppError("VALIDATION_ERROR", "No fields to update", 400);
    const values = fields.map((f) => req.body[f]);
    const result = await pool.query(updateBlogCategoryQuery(fields), [req.params.id, ...values]);
    if (!result.rows[0]) throw new AppError("NOT_FOUND", "Blog category not found", 404);
    return success(res, result.rows[0], "Blog category updated");
  } catch (err) {
    next(err);
  }
};

export const deleteBlogCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(softDeleteBlogCategory, [req.params.id]);
    if (!result.rows[0]) throw new AppError("NOT_FOUND", "Blog category not found", 404);
    return success(res, result.rows[0], "Blog category deleted");
  } catch (err) {
    next(err);
  }
};

export const deleteBlogCategoryPermanently = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const linked = await pool.query<{ count: number }>(countBlogsByCategory, [req.params.id]);
    if (linked.rows[0].count > 0) {
      throw new AppError("CONFLICT", "Cannot delete blog category with linked blogs", 409);
    }
    const result = await pool.query(hardDeleteBlogCategory, [req.params.id]);
    if (!result.rows[0]) throw new AppError("NOT_FOUND", "Blog category not found", 404);
    return success(res, result.rows[0], "Blog category permanently deleted");
  } catch (err) {
    next(err);
  }
};

// ─── Admin: blog authors ─────────────────────────────────────

export const listBlogAuthorsAdmin = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(listAllBlogAuthors);
    return success(res, result.rows);
  } catch (err) {
    next(err);
  }
};

export const createBlogAuthor = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const file = req.file as MulterS3File | undefined;
    const { name, bio, user_id } = req.body;
    const slug = await generateUniqueSlug(name, "blogs");
    const result = await pool.query(createBlogAuthorQuery, [name, slug, bio ?? null, user_id ?? null, file?.location ?? null]);
    return success(res, result.rows[0], "Blog author created", 201);
  } catch (err) {
    next(err);
  }
};

export const updateBlogAuthor = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const file = req.file as MulterS3File | undefined;
    const fields = Object.keys(req.body);
    const values = fields.map((f) => req.body[f]);
    if (file) {
      fields.push("avatar_url");
      values.push(file.location);
    }
    if (fields.length === 0) throw new AppError("VALIDATION_ERROR", "No fields to update", 400);
    const result = await pool.query(updateBlogAuthorQuery(fields), [req.params.id, ...values]);
    if (!result.rows[0]) throw new AppError("NOT_FOUND", "Blog author not found", 404);
    return success(res, result.rows[0], "Blog author updated");
  } catch (err) {
    next(err);
  }
};

export const deleteBlogAuthor = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(deleteBlogAuthorQuery, [req.params.id]);
    if (!result.rows[0]) throw new AppError("NOT_FOUND", "Blog author not found", 404);
    return success(res, result.rows[0], "Blog author deleted");
  } catch (err) {
    next(err);
  }
};

// ─── Public: blogs ───────────────────────────────────────────

export const listBlogsPublic = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = req.query as unknown as { page: number; limit: number; category?: string; featured?: boolean };
    const { limit: safeLimit, offset, meta } = paginate(q.page, q.limit);

    const values: unknown[] = [];
    const whereClauses: string[] = ["b.status = 'published'"];
    const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

    if (q.category) {
      values.push(q.category);
      whereClauses.push(isUuid(q.category) ? `b.category_id = $${values.length}` : `bc.slug = $${values.length}`);
    }
    if (q.featured !== undefined) {
      values.push(q.featured);
      whereClauses.push(`b.is_featured = $${values.length}`);
    }

    const [rows, count] = await Promise.all([
      pool.query(listBlogsQuery(whereClauses, values.length + 1, values.length + 2), [...values, safeLimit, offset]),
      pool.query<{ count: number }>(countBlogs(whereClauses), values),
    ]);

    return success(res, rows.rows, "Blogs fetched", 200, meta(count.rows[0].count));
  } catch (err) {
    next(err);
  }
};

export const getBlogBySlug = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [blogResult, sidebarResult] = await Promise.all([
      pool.query(findBlogBySlug, [req.params.slug]),
      pool.query(listSidebarServices),
    ]);
    if (!blogResult.rows[0]) throw new AppError("NOT_FOUND", "Blog not found", 404);

    return success(res, { ...blogResult.rows[0], sidebar_services: sidebarResult.rows });
  } catch (err) {
    next(err);
  }
};

// ─── Admin: blogs ────────────────────────────────────────────

export const listBlogsAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = req.query as unknown as { page?: string; limit?: string; status?: string; category_id?: string };
    const { limit: safeLimit, offset, meta } = paginate(Number(q.page) || 1, Number(q.limit) || 20);

    const values: unknown[] = [];
    const whereClauses: string[] = [];
    if (q.status) {
      values.push(q.status);
      whereClauses.push(`b.status = $${values.length}`);
    }
    if (q.category_id) {
      values.push(q.category_id);
      whereClauses.push(`b.category_id = $${values.length}`);
    }

    const [rows, count] = await Promise.all([
      pool.query(listBlogsAdminQuery(whereClauses, values.length + 1, values.length + 2), [...values, safeLimit, offset]),
      pool.query<{ count: number }>(countBlogsAdmin(whereClauses), values),
    ]);

    return success(res, rows.rows, "Blogs fetched", 200, meta(count.rows[0].count));
  } catch (err) {
    next(err);
  }
};

export const getBlogAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(findBlogByIdAdmin, [req.params.id]);
    if (!result.rows[0]) throw new AppError("NOT_FOUND", "Blog not found", 404);
    return success(res, result.rows[0]);
  } catch (err) {
    next(err);
  }
};

export const createBlog = async (req: Request, res: Response, next: NextFunction) => {
  const client = await pool.connect();
  try {
    const files = req.files as MulterS3Files | undefined;
    const featureImage = files?.feature_image?.[0];

    const {
      title, category_id, author_id, excerpt, content, is_featured, status,
      published_at, recommended_blog_ids, meta_title, meta_description,
    } = req.body;

    const slug = await generateUniqueSlug(title, "blogs");
    const sanitizedContent = DOMPurify.sanitize(content);
    const resolvedPublishedAt = status === "published" ? (published_at ?? new Date()) : published_at ?? null;

    await client.query("BEGIN");
    const result = await client.query(createBlogQuery, [
      title, slug, category_id ?? null, author_id ?? null, excerpt ?? null, sanitizedContent,
      featureImage?.location ?? null, is_featured, status, resolvedPublishedAt, meta_title ?? null, meta_description ?? null,
    ]);
    const blog = result.rows[0];

    if (recommended_blog_ids.length > 0) {
      const filtered = recommended_blog_ids.filter((id: string) => id !== blog.id);
      if (filtered.length > 0) await client.query(setRecommendedBlogs, [blog.id, filtered]);
    }

    if (files?.images && files.images.length > 0) {
      for (const [i, img] of files.images.entries()) {
        await client.query(insertBlogImage, [blog.id, img.location, null, i]);
      }
    }

    await client.query("COMMIT");
    return success(res, blog, "Blog created", 201);
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
};

export const updateBlog = async (req: Request, res: Response, next: NextFunction) => {
  const client = await pool.connect();
  try {
    const existing = await client.query(findBlogById, [req.params.id]);
    if (!existing.rows[0]) throw new AppError("NOT_FOUND", "Blog not found", 404);

    const { recommended_blog_ids, content, ...rest } = req.body;
    const files = req.files as MulterS3Files | undefined;

    const fields: string[] = [];
    const values: unknown[] = [];
    for (const [key, value] of Object.entries(rest)) {
      fields.push(key);
      values.push(value);
    }
    if (content !== undefined) {
      fields.push("content");
      values.push(DOMPurify.sanitize(content));
    }
    if (rest.status === "published" && rest.published_at === undefined && !existing.rows[0].published_at) {
      fields.push("published_at");
      values.push(new Date());
    }
    if (fields.includes("title")) {
      const newSlug = await generateUniqueSlug(rest.title as string, "blogs", req.params.id);
      fields.push("slug");
      values.push(newSlug);
    }
    if (files?.feature_image?.[0]) {
      fields.push("feature_image_url");
      values.push(files.feature_image[0].location);
    }

    await client.query("BEGIN");

    if (fields.length > 0) {
      await client.query(updateBlogQuery(fields), [req.params.id, ...values]);
    }

    if (recommended_blog_ids !== undefined) {
      await client.query(clearRecommendedBlogs, [req.params.id]);
      const filtered = recommended_blog_ids.filter((id: string) => id !== req.params.id);
      if (filtered.length > 0) await client.query(setRecommendedBlogs, [req.params.id, filtered]);
    }

    if (files?.images && files.images.length > 0) {
      const maxOrder = await client.query<{ max_order: number }>(maxBlogImageOrder, [req.params.id]);
      let nextOrder = maxOrder.rows[0].max_order + 1;
      for (const img of files.images) {
        await client.query(insertBlogImage, [req.params.id, img.location, null, nextOrder]);
        nextOrder += 1;
      }
    }

    await client.query("COMMIT");

    const detail = await pool.query(findBlogById, [req.params.id]);
    return success(res, detail.rows[0], "Blog updated");
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
};

export const deleteBlog = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(softDeleteBlog, [req.params.id]);
    if (!result.rows[0]) throw new AppError("NOT_FOUND", "Blog not found", 404);
    return success(res, result.rows[0], "Blog deleted");
  } catch (err) {
    next(err);
  }
};

export const deleteBlogPermanently = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const galleryUrls = (await pool.query<{ image_url: string }>(findBlogImageUrls, [req.params.id])).rows;
    const result = await pool.query(hardDeleteBlog, [req.params.id]);
    if (!result.rows[0]) throw new AppError("NOT_FOUND", "Blog not found", 404);
    if (result.rows[0].feature_image_url) await deleteFromS3(result.rows[0].feature_image_url);
    for (const row of galleryUrls) await deleteFromS3(row.image_url);
    return success(res, result.rows[0], "Blog permanently deleted");
  } catch (err) {
    next(err);
  }
};
