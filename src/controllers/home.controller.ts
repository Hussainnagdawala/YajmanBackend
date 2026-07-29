import { Request, Response, NextFunction } from "express";
import { pool } from "../config/database";
import { success } from "../utils/response";
import { AppError } from "../utils/errors";
import { deleteFromS3 } from "../services/upload.service";
import {
  listActivePopularSearches,
  listAllPopularSearches,
  createPopularSearch as createPopularSearchQuery,
  updatePopularSearch as updatePopularSearchQuery,
  softDeletePopularSearch,
  listActiveBannersByPosition,
  listAllBanners,
  createBanner as createBannerQuery,
  updateBanner as updateBannerQuery,
  softDeleteBanner,
  hardDeleteBanner,
  listActiveTestimonials,
  listAllTestimonials,
  createTestimonial as createTestimonialQuery,
  updateTestimonial as updateTestimonialQuery,
  softDeleteTestimonial,
  listRecommendedServices,
  listAllRecommendedServices,
  createRecommendedService as createRecommendedServiceQuery,
  updateRecommendedService as updateRecommendedServiceQuery,
  softDeleteRecommendedService,
  listRecentBlogs,
  getAppSettingsByKeys,
} from "../queries/home.queries";
import { listActiveCategories } from "../queries/category.queries";
import { listBestsellers } from "../queries/service.queries";

type MulterS3File = Express.MulterS3.File;

// ─── Public: home aggregator ─────────────────────────────────

export const getHome = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [heroBanners, offerBanners, popularSearches, testimonials, categories, bestsellerRows, recentBlogs, settings] =
      await Promise.all([
        pool.query(listActiveBannersByPosition, ["hero_slider"]),
        pool.query(listActiveBannersByPosition, ["middle_ad"]),
        pool.query(listActivePopularSearches),
        pool.query(listActiveTestimonials, ["home"]),
        pool.query(listActiveCategories),
        pool.query(listBestsellers),
        pool.query(listRecentBlogs),
        pool.query<{ key: string; value: string }>(getAppSettingsByKeys, [
          ["stats_pujas_completed", "stats_connected_pandits"],
        ]),
      ]);

    const bestsellersByCategory: Record<string, unknown[]> = {};
    for (const row of bestsellerRows.rows) {
      const key = row.category_slug.replace(/-/g, "_");
      if (!bestsellersByCategory[key]) bestsellersByCategory[key] = [];
      bestsellersByCategory[key].push(row);
    }

    const settingsMap = Object.fromEntries(settings.rows.map((r) => [r.key, r.value]));

    return success(res, {
      banners: heroBanners.rows,
      popular_searches: popularSearches.rows,
      testimonials: testimonials.rows,
      bestsellers: bestsellersByCategory,
      categories: categories.rows,
      offer_banner: offerBanners.rows[0] ?? null,
      recent_blogs: recentBlogs.rows,
      stats: {
        pujas_completed: Number(settingsMap.stats_pujas_completed ?? 0),
        connected_pandits: Number(settingsMap.stats_connected_pandits ?? 0),
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── Admin: popular searches ─────────────────────────────────

export const listPopularSearchesAdmin = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(listAllPopularSearches);
    return success(res, result.rows);
  } catch (err) {
    next(err);
  }
};

export const createPopularSearch = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { label, link_url, display_order, row_number } = req.body;
    const result = await pool.query(createPopularSearchQuery, [label, link_url ?? null, display_order, row_number]);
    return success(res, result.rows[0], "Popular search created", 201);
  } catch (err) {
    next(err);
  }
};

export const updatePopularSearch = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fields = Object.keys(req.body);
    if (fields.length === 0) throw new AppError("VALIDATION_ERROR", "No fields to update", 400);
    const values = fields.map((f) => req.body[f]);
    const result = await pool.query(updatePopularSearchQuery(fields), [req.params.id, ...values]);
    if (!result.rows[0]) throw new AppError("NOT_FOUND", "Popular search not found", 404);
    return success(res, result.rows[0], "Popular search updated");
  } catch (err) {
    next(err);
  }
};

export const deletePopularSearch = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(softDeletePopularSearch, [req.params.id]);
    if (!result.rows[0]) throw new AppError("NOT_FOUND", "Popular search not found", 404);
    return success(res, result.rows[0], "Popular search deleted");
  } catch (err) {
    next(err);
  }
};

// ─── Admin: banners ───────────────────────────────────────────

export const listBannersAdmin = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(listAllBanners);
    return success(res, result.rows);
  } catch (err) {
    next(err);
  }
};

export const createBanner = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const files = req.files as Record<string, MulterS3File[]> | undefined;
    const image = files?.image?.[0];
    if (!image) throw new AppError("VALIDATION_ERROR", "image file is required", 400);
    const mobileImage = files?.mobile_image?.[0];

    const {
      title, subtitle, description, link_url, cta_text, position,
      discount_text, bg_color, text_color, display_order, starts_at, ends_at,
    } = req.body;

    const result = await pool.query(createBannerQuery, [
      title ?? null, subtitle ?? null, description ?? null, image.location, mobileImage?.location ?? null,
      link_url ?? null, cta_text ?? null, position, discount_text ?? null, bg_color ?? null, text_color ?? null,
      display_order, starts_at ?? null, ends_at ?? null,
    ]);
    return success(res, result.rows[0], "Banner created", 201);
  } catch (err) {
    next(err);
  }
};

export const updateBanner = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const files = req.files as Record<string, MulterS3File[]> | undefined;
    const fields: string[] = [];
    const values: unknown[] = [];

    for (const [key, value] of Object.entries(req.body)) {
      fields.push(key);
      values.push(value);
    }
    if (files?.image?.[0]) {
      fields.push("image_url");
      values.push(files.image[0].location);
    }
    if (files?.mobile_image?.[0]) {
      fields.push("mobile_image_url");
      values.push(files.mobile_image[0].location);
    }
    if (fields.length === 0) throw new AppError("VALIDATION_ERROR", "No fields to update", 400);

    const result = await pool.query(updateBannerQuery(fields), [req.params.id, ...values]);
    if (!result.rows[0]) throw new AppError("NOT_FOUND", "Banner not found", 404);
    return success(res, result.rows[0], "Banner updated");
  } catch (err) {
    next(err);
  }
};

export const deleteBanner = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(softDeleteBanner, [req.params.id]);
    if (!result.rows[0]) throw new AppError("NOT_FOUND", "Banner not found", 404);
    return success(res, result.rows[0], "Banner deleted");
  } catch (err) {
    next(err);
  }
};

// Permanent delete — no undo. Also removes the uploaded image file from disk,
// unlike the soft delete above which leaves it in place (banner can be restored).
export const deleteBannerPermanently = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(hardDeleteBanner, [req.params.id]);
    if (!result.rows[0]) throw new AppError("NOT_FOUND", "Banner not found", 404);
    if (result.rows[0].image_url) await deleteFromS3(result.rows[0].image_url);
    if (result.rows[0].mobile_image_url) await deleteFromS3(result.rows[0].mobile_image_url);
    return success(res, result.rows[0], "Banner permanently deleted");
  } catch (err) {
    next(err);
  }
};

// ─── Admin: testimonials ──────────────────────────────────────

export const listTestimonialsAdmin = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(listAllTestimonials);
    return success(res, result.rows);
  } catch (err) {
    next(err);
  }
};

export const createTestimonial = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const file = req.file as MulterS3File | undefined;
    const { author_name, author_designation, quote, rating, page, display_order } = req.body;

    const result = await pool.query(createTestimonialQuery, [
      author_name, author_designation ?? null, file?.location ?? null, quote, rating ?? null, page, display_order,
    ]);
    return success(res, result.rows[0], "Testimonial created", 201);
  } catch (err) {
    next(err);
  }
};

export const updateTestimonial = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const file = req.file as MulterS3File | undefined;
    const fields: string[] = [];
    const values: unknown[] = [];

    for (const [key, value] of Object.entries(req.body)) {
      fields.push(key);
      values.push(value);
    }
    if (file) {
      fields.push("author_avatar_url");
      values.push(file.location);
    }
    if (fields.length === 0) throw new AppError("VALIDATION_ERROR", "No fields to update", 400);

    const result = await pool.query(updateTestimonialQuery(fields), [req.params.id, ...values]);
    if (!result.rows[0]) throw new AppError("NOT_FOUND", "Testimonial not found", 404);
    return success(res, result.rows[0], "Testimonial updated");
  } catch (err) {
    next(err);
  }
};

export const deleteTestimonial = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(softDeleteTestimonial, [req.params.id]);
    if (!result.rows[0]) throw new AppError("NOT_FOUND", "Testimonial not found", 404);
    return success(res, result.rows[0], "Testimonial deleted");
  } catch (err) {
    next(err);
  }
};

// ─── Admin: recommended services ──────────────────────────────

export const listRecommendedServicesAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, section } = req.query as { page?: string; section?: string };
    if (page && section) {
      const result = await pool.query(listRecommendedServices, [page, section]);
      return success(res, result.rows);
    }
    const result = await pool.query(listAllRecommendedServices);
    return success(res, result.rows);
  } catch (err) {
    next(err);
  }
};

export const createRecommendedService = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { service_id, page, section, display_order } = req.body;
    const result = await pool.query(createRecommendedServiceQuery, [service_id, page, section, display_order]);
    return success(res, result.rows[0], "Recommended service created", 201);
  } catch (err) {
    next(err);
  }
};

export const updateRecommendedService = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fields = Object.keys(req.body);
    if (fields.length === 0) throw new AppError("VALIDATION_ERROR", "No fields to update", 400);
    const values = fields.map((f) => req.body[f]);
    const result = await pool.query(updateRecommendedServiceQuery(fields), [req.params.id, ...values]);
    if (!result.rows[0]) throw new AppError("NOT_FOUND", "Recommended service not found", 404);
    return success(res, result.rows[0], "Recommended service updated");
  } catch (err) {
    next(err);
  }
};

export const deleteRecommendedService = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(softDeleteRecommendedService, [req.params.id]);
    if (!result.rows[0]) throw new AppError("NOT_FOUND", "Recommended service not found", 404);
    return success(res, result.rows[0], "Recommended service deleted");
  } catch (err) {
    next(err);
  }
};
