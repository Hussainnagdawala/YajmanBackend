import { Request, Response, NextFunction } from "express";
import { pool } from "../config/database";
import { success } from "../utils/response";
import { AppError } from "../utils/errors";
import { generateUniqueSlug } from "../services/slug.service";
import { deleteFromS3 } from "../services/upload.service";
import {
  listActiveTypes,
  listAllTypes,
  createType as createTypeQuery,
  updateType as updateTypeQuery,
  softDeleteType,
  hardDeleteType,
  countServicesByType,
} from "../queries/category.queries";

export const listTypes = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(listActiveTypes);
    return success(res, result.rows);
  } catch (err) {
    next(err);
  }
};

export const listTypesAdmin = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(listAllTypes);
    return success(res, result.rows);
  } catch (err) {
    next(err);
  }
};

export const createType = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description, display_order } = req.body;
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const imageUrl = (files?.["image"]?.[0] as Express.MulterS3.File | undefined)?.location ?? null;
    const iconUrl = (files?.["icon"]?.[0] as Express.MulterS3.File | undefined)?.location ?? null;
    const slug = await generateUniqueSlug(name, "types");

    const result = await pool.query(createTypeQuery, [name, slug, description ?? null, imageUrl, iconUrl, display_order ?? 0]);
    return success(res, result.rows[0], "Type created", 201);
  } catch (err) {
    next(err);
  }
};

export const updateType = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fields: string[] = [];
    const values: unknown[] = [];

    for (const [key, value] of Object.entries(req.body)) {
      fields.push(key);
      values.push(value);
    }
    if (fields.includes("name")) {
      const newSlug = await generateUniqueSlug(req.body.name, "types", req.params.id);
      fields.push("slug");
      values.push(newSlug);
    }

    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const imageFile = files?.["image"]?.[0] as Express.MulterS3.File | undefined;
    const iconFile = files?.["icon"]?.[0] as Express.MulterS3.File | undefined;
    if (imageFile) {
      fields.push("image_url");
      values.push(imageFile.location);
    }
    if (iconFile) {
      fields.push("icon_url");
      values.push(iconFile.location);
    }

    if (fields.length === 0) throw new AppError("VALIDATION_ERROR", "No fields to update", 400);

    const result = await pool.query(updateTypeQuery(fields), [req.params.id, ...values]);
    if (!result.rows[0]) throw new AppError("NOT_FOUND", "Type not found", 404);
    return success(res, result.rows[0], "Type updated");
  } catch (err) {
    next(err);
  }
};

export const deleteType = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(softDeleteType, [req.params.id]);
    if (!result.rows[0]) throw new AppError("NOT_FOUND", "Type not found", 404);
    return success(res, result.rows[0], "Type deleted");
  } catch (err) {
    next(err);
  }
};

export const deleteTypePermanently = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const linked = await pool.query<{ count: number }>(countServicesByType, [req.params.id]);
    if (linked.rows[0].count > 0) {
      throw new AppError("CONFLICT", "Cannot delete type with linked services", 409);
    }
    const result = await pool.query(hardDeleteType, [req.params.id]);
    if (!result.rows[0]) throw new AppError("NOT_FOUND", "Type not found", 404);
    if (result.rows[0].image_url) await deleteFromS3(result.rows[0].image_url);
    return success(res, result.rows[0], "Type permanently deleted");
  } catch (err) {
    next(err);
  }
};
