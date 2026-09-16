import { Request, Response, NextFunction } from "express";
import { pool } from "../config/database";
import { success } from "../utils/response";
import { AppError } from "../utils/errors";
import { deleteFromS3 } from "../services/upload.service";
import {
  listActiveGalleryImages,
  listAllGalleryImages,
  insertGalleryImage,
  maxGalleryImageOrder,
  updateGalleryImage as updateGalleryImageQuery,
  softDeleteGalleryImage,
  hardDeleteGalleryImage,
} from "../queries/gallery.queries";

// ─── Public ──────────────────────────────────────────────────

export const listGalleryPublic = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(listActiveGalleryImages);
    return success(res, result.rows);
  } catch (err) {
    next(err);
  }
};

// ─── Admin ───────────────────────────────────────────────────

export const listGalleryAdmin = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(listAllGalleryImages);
    return success(res, result.rows);
  } catch (err) {
    next(err);
  }
};

export const createGalleryImages = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const files = (req.files as Express.MulterS3.File[] | undefined) ?? [];
    if (files.length === 0) throw new AppError("VALIDATION_ERROR", "At least one image file is required", 400);

    const maxOrder = await pool.query<{ max_order: number }>(maxGalleryImageOrder);
    let nextOrder = maxOrder.rows[0].max_order + 1;
    const inserted = [];
    for (const file of files) {
      const result = await pool.query(insertGalleryImage, [file.location, nextOrder]);
      inserted.push(result.rows[0]);
      nextOrder += 1;
    }

    return success(res, inserted, "Gallery images uploaded", 201);
  } catch (err) {
    next(err);
  }
};

export const updateGalleryImage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fields = Object.keys(req.body);
    if (fields.length === 0) throw new AppError("VALIDATION_ERROR", "No fields to update", 400);

    const values = fields.map((f) => req.body[f]);
    const result = await pool.query(updateGalleryImageQuery(fields), [req.params.id, ...values]);
    if (!result.rows[0]) throw new AppError("NOT_FOUND", "Gallery image not found", 404);
    return success(res, result.rows[0], "Gallery image updated");
  } catch (err) {
    next(err);
  }
};

export const deleteGalleryImage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(softDeleteGalleryImage, [req.params.id]);
    if (!result.rows[0]) throw new AppError("NOT_FOUND", "Gallery image not found", 404);
    return success(res, result.rows[0], "Gallery image deleted");
  } catch (err) {
    next(err);
  }
};

export const deleteGalleryImagePermanently = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(hardDeleteGalleryImage, [req.params.id]);
    if (!result.rows[0]) throw new AppError("NOT_FOUND", "Gallery image not found", 404);
    if (result.rows[0].image_url) await deleteFromS3(result.rows[0].image_url);
    return success(res, result.rows[0], "Gallery image permanently deleted");
  } catch (err) {
    next(err);
  }
};
