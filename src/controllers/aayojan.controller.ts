import { Request, Response, NextFunction } from "express";
import { pool } from "../config/database";
import { success } from "../utils/response";
import { AppError } from "../utils/errors";
import { generateUniqueSlug } from "../services/slug.service";
import {
  listActiveAayojanContent,
  listAllAayojanContent,
  createAayojanContent as createAayojanContentQuery,
  updateAayojanContent as updateAayojanContentQuery,
  softDeleteAayojanContent,
  listActiveAayojanEvents,
  listAllAayojanEvents,
  findAayojanEventById,
  findAayojanEventBySlug,
  createAayojanEvent as createAayojanEventQuery,
  updateAayojanEvent as updateAayojanEventQuery,
  softDeleteAayojanEvent,
  insertAayojanEventImage,
  maxAayojanEventImageOrder,
  listActiveAayojanBanners,
  listAllAayojanBanners,
  createAayojanBanner as createAayojanBannerQuery,
  updateAayojanBanner as updateAayojanBannerQuery,
  softDeleteAayojanBanner,
} from "../queries/aayojan.queries";
import { listActiveTestimonials } from "../queries/home.queries";

type MulterS3Files = Record<string, Express.MulterS3.File[]>;

// ─── Public: aayojan aggregator ───────────────────────────────

export const getAayojan = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [content, events, banners, testimonials] = await Promise.all([
      pool.query(listActiveAayojanContent),
      pool.query(listActiveAayojanEvents),
      pool.query(listActiveAayojanBanners),
      pool.query(listActiveTestimonials, ["aayojan"]),
    ]);

    return success(res, {
      content: content.rows,
      events: events.rows,
      banners: banners.rows,
      testimonials: testimonials.rows,
    });
  } catch (err) {
    next(err);
  }
};

export const getAayojanEventBySlug = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(findAayojanEventBySlug, [req.params.slug]);
    if (!result.rows[0]) throw new AppError("NOT_FOUND", "Event not found", 404);
    return success(res, result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// ─── Admin: page content ──────────────────────────────────────

export const listAayojanContentAdmin = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(listAllAayojanContent);
    return success(res, result.rows);
  } catch (err) {
    next(err);
  }
};

export const createAayojanContent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { section_key, title, subtitle, description, cta_text, cta_link, display_order } = req.body;
    const files = req.files as MulterS3Files | undefined;
    const imageUrl = files?.image?.[0]?.location ?? null;

    const result = await pool.query(createAayojanContentQuery, [
      section_key, title ?? null, subtitle ?? null, description ?? null, imageUrl,
      cta_text ?? null, cta_link ?? null, display_order,
    ]);
    return success(res, result.rows[0], "Aayojan content created", 201);
  } catch (err) {
    next(err);
  }
};

export const updateAayojanContent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const files = req.files as MulterS3Files | undefined;
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
    if (fields.length === 0) throw new AppError("VALIDATION_ERROR", "No fields to update", 400);

    const result = await pool.query(updateAayojanContentQuery(fields), [req.params.id, ...values]);
    if (!result.rows[0]) throw new AppError("NOT_FOUND", "Aayojan content not found", 404);
    return success(res, result.rows[0], "Aayojan content updated");
  } catch (err) {
    next(err);
  }
};

export const deleteAayojanContent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(softDeleteAayojanContent, [req.params.id]);
    if (!result.rows[0]) throw new AppError("NOT_FOUND", "Aayojan content not found", 404);
    return success(res, result.rows[0], "Aayojan content deleted");
  } catch (err) {
    next(err);
  }
};

// ─── Admin: events ─────────────────────────────────────────────

export const listAayojanEventsAdmin = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(listAllAayojanEvents);
    return success(res, result.rows);
  } catch (err) {
    next(err);
  }
};

export const createAayojanEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const files = req.files as MulterS3Files | undefined;
    const featureImage = files?.feature_image?.[0];

    const {
      title, description, short_description, location, city,
      event_date, event_time, price, original_price, max_capacity, status,
    } = req.body;

    const slug = await generateUniqueSlug(title, "aayojan_events");
    const result = await pool.query(createAayojanEventQuery, [
      title, slug, description ?? null, short_description ?? null, featureImage?.location ?? null,
      location ?? null, city ?? null, event_date ?? null, event_time ?? null,
      price ?? null, original_price ?? null, max_capacity ?? null, status,
    ]);
    const event = result.rows[0];

    if (files?.images && files.images.length > 0) {
      for (const [i, img] of files.images.entries()) {
        await pool.query(insertAayojanEventImage, [event.id, img.location, i]);
      }
    }

    return success(res, event, "Event created", 201);
  } catch (err) {
    next(err);
  }
};

export const updateAayojanEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await pool.query(findAayojanEventById, [req.params.id]);
    if (!existing.rows[0]) throw new AppError("NOT_FOUND", "Event not found", 404);

    const files = req.files as MulterS3Files | undefined;
    const fields: string[] = [];
    const values: unknown[] = [];
    for (const [key, value] of Object.entries(req.body)) {
      fields.push(key);
      values.push(value);
    }
    if (fields.includes("title")) {
      const newSlug = await generateUniqueSlug(req.body.title as string, "aayojan_events", req.params.id);
      fields.push("slug");
      values.push(newSlug);
    }
    if (files?.feature_image?.[0]) {
      fields.push("feature_image_url");
      values.push(files.feature_image[0].location);
    }

    let event = existing.rows[0];
    if (fields.length > 0) {
      const result = await pool.query(updateAayojanEventQuery(fields), [req.params.id, ...values]);
      event = result.rows[0];
    }

    if (files?.images && files.images.length > 0) {
      const maxOrder = await pool.query<{ max_order: number }>(maxAayojanEventImageOrder, [req.params.id]);
      let nextOrder = maxOrder.rows[0].max_order + 1;
      for (const img of files.images) {
        await pool.query(insertAayojanEventImage, [req.params.id, img.location, nextOrder]);
        nextOrder += 1;
      }
    }

    return success(res, event, "Event updated");
  } catch (err) {
    next(err);
  }
};

export const deleteAayojanEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(softDeleteAayojanEvent, [req.params.id]);
    if (!result.rows[0]) throw new AppError("NOT_FOUND", "Event not found", 404);
    return success(res, result.rows[0], "Event deleted");
  } catch (err) {
    next(err);
  }
};

// ─── Admin: banners ────────────────────────────────────────────

export const listAayojanBannersAdmin = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(listAllAayojanBanners);
    return success(res, result.rows);
  } catch (err) {
    next(err);
  }
};

export const createAayojanBanner = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const file = req.file as Express.MulterS3.File | undefined;
    if (!file) throw new AppError("VALIDATION_ERROR", "image file is required", 400);

    const { title, link_url, display_order } = req.body;
    const result = await pool.query(createAayojanBannerQuery, [title ?? null, file.location, link_url ?? null, display_order]);
    return success(res, result.rows[0], "Aayojan banner created", 201);
  } catch (err) {
    next(err);
  }
};

export const updateAayojanBanner = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const file = req.file as Express.MulterS3.File | undefined;
    const fields: string[] = [];
    const values: unknown[] = [];
    for (const [key, value] of Object.entries(req.body)) {
      fields.push(key);
      values.push(value);
    }
    if (file) {
      fields.push("image_url");
      values.push(file.location);
    }
    if (fields.length === 0) throw new AppError("VALIDATION_ERROR", "No fields to update", 400);

    const result = await pool.query(updateAayojanBannerQuery(fields), [req.params.id, ...values]);
    if (!result.rows[0]) throw new AppError("NOT_FOUND", "Aayojan banner not found", 404);
    return success(res, result.rows[0], "Aayojan banner updated");
  } catch (err) {
    next(err);
  }
};

export const deleteAayojanBanner = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(softDeleteAayojanBanner, [req.params.id]);
    if (!result.rows[0]) throw new AppError("NOT_FOUND", "Aayojan banner not found", 404);
    return success(res, result.rows[0], "Aayojan banner deleted");
  } catch (err) {
    next(err);
  }
};
