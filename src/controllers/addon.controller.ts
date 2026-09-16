import { Request, Response, NextFunction } from "express";
import { pool } from "../config/database";
import { success } from "../utils/response";
import { AppError } from "../utils/errors";
import { generateUniqueSlug } from "../services/slug.service";
import { deleteFromS3 } from "../services/upload.service";
import {
  listActiveAddons,
  listAllAddons,
  createAddon as createAddonQuery,
  updateAddon as updateAddonQuery,
  softDeleteAddon,
  hardDeleteAddon,
} from "../queries/addon.queries";

export const listAddons = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(listActiveAddons);
    return success(res, result.rows);
  } catch (err) {
    next(err);
  }
};

export const listAddonsAdmin = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(listAllAddons);
    return success(res, result.rows);
  } catch (err) {
    next(err);
  }
};

export const createAddon = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, price, is_free, display_order } = req.body;
    const imageUrl = (req.file as Express.MulterS3.File | undefined)?.location ?? null;
    const slug = await generateUniqueSlug(name, "addons");
    const finalPrice = is_free ? 0 : price;

    const result = await pool.query(createAddonQuery, [name, slug, imageUrl, finalPrice, display_order ?? 0, is_free]);
    return success(res, result.rows[0], "Addon created", 201);
  } catch (err) {
    next(err);
  }
};

export const updateAddon = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fields: string[] = [];
    const values: unknown[] = [];

    for (const [key, value] of Object.entries(req.body)) {
      fields.push(key);
      values.push(value);
    }
    if (fields.includes("name")) {
      const newSlug = await generateUniqueSlug(req.body.name, "addons", req.params.id);
      fields.push("slug");
      values.push(newSlug);
    }
    const file = req.file as Express.MulterS3.File | undefined;
    if (file) {
      fields.push("image_url");
      values.push(file.location);
    }
    // Keep price/is_free consistent when a PATCH flips is_free to true —
    // never leave a stale non-zero price alongside is_free = true.
    if (req.body.is_free === true) {
      const priceIdx = fields.indexOf("price");
      if (priceIdx >= 0) {
        values[priceIdx] = 0;
      } else {
        fields.push("price");
        values.push(0);
      }
    }

    if (fields.length === 0) throw new AppError("VALIDATION_ERROR", "No fields to update", 400);

    const result = await pool.query(updateAddonQuery(fields), [req.params.id, ...values]);
    if (!result.rows[0]) throw new AppError("NOT_FOUND", "Addon not found", 404);
    return success(res, result.rows[0], "Addon updated");
  } catch (err) {
    next(err);
  }
};

export const deleteAddon = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(softDeleteAddon, [req.params.id]);
    if (!result.rows[0]) throw new AppError("NOT_FOUND", "Addon not found", 404);
    return success(res, result.rows[0], "Addon deleted");
  } catch (err) {
    next(err);
  }
};

export const deleteAddonPermanently = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(hardDeleteAddon, [req.params.id]);
    if (!result.rows[0]) throw new AppError("NOT_FOUND", "Addon not found", 404);
    if (result.rows[0].image_url) await deleteFromS3(result.rows[0].image_url);
    return success(res, result.rows[0], "Addon permanently deleted");
  } catch (err) {
    next(err);
  }
};
