import { Request, Response, NextFunction } from "express";
import { pool } from "../config/database";
import { success } from "../utils/response";
import { AppError } from "../utils/errors";
import { generateUniqueSlug } from "../services/slug.service";
import { deleteFromS3 } from "../services/upload.service";
import {
  listActiveCategories,
  listAllCategories,
  findCategoryById,
  createCategory as createCategoryQuery,
  updateCategory as updateCategoryQuery,
  softDeleteCategory,
  hardDeleteCategory,
  countServicesByCategory,
  setCategoryTypes,
  clearCategoryTypes,
} from "../queries/category.queries";
import { PANDITJI_AT_HOME_SLUG } from "../utils/booking-time";

type MulterS3Files = Record<string, Express.MulterS3.File[]>;

const normalizeBookingTimeFlag = (slug: string, requiresBookingTime?: boolean): boolean => {
  if (slug === PANDITJI_AT_HOME_SLUG) return true;
  if (requiresBookingTime) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Time slot selection is only available for the PanditJi At Home category",
      400,
      [{ field: "requires_booking_time", message: "Only PanditJi At Home can require a booking time slot" }]
    );
  }
  return false;
};

export const listCategories = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(listActiveCategories);
    return success(res, result.rows);
  } catch (err) {
    next(err);
  }
};

export const listCategoriesAdmin = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(listAllCategories);
    return success(res, result.rows);
  } catch (err) {
    next(err);
  }
};

export const getCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(findCategoryById, [req.params.id]);
    if (!result.rows[0]) throw new AppError("NOT_FOUND", "Category not found", 404);
    return success(res, result.rows[0]);
  } catch (err) {
    next(err);
  }
};

export const createCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description, type_ids, display_order, meta_title, meta_description, requires_pandit, requires_payment, requires_booking_time } = req.body;
    const files = req.files as MulterS3Files | undefined;
    const imageUrl = files?.image?.[0]?.location ?? null;
    const iconUrl = files?.icon?.[0]?.location ?? null;

    const slug = await generateUniqueSlug(name, "categories");
    const finalRequiresBookingTime = normalizeBookingTimeFlag(slug, requires_booking_time);

    const result = await pool.query(createCategoryQuery, [
      name,
      slug,
      description ?? null,
      imageUrl,
      iconUrl,
      display_order ?? 0,
      meta_title ?? null,
      meta_description ?? null,
      requires_pandit,
      requires_payment,
      finalRequiresBookingTime,
    ]);
    const category = result.rows[0];

    if (Array.isArray(type_ids) && type_ids.length > 0) {
      await pool.query(setCategoryTypes, [category.id, type_ids]);
    }

    return success(res, category, "Category created", 201);
  } catch (err) {
    next(err);
  }
};

export const updateCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type_ids, ...rest } = req.body;
    const files = req.files as MulterS3Files | undefined;

    const fields: string[] = [];
    const values: unknown[] = [];

    for (const [key, value] of Object.entries(rest)) {
      fields.push(key);
      values.push(value);
    }
    if (fields.includes("name")) {
      const newSlug = await generateUniqueSlug(rest.name, "categories", req.params.id);
      fields.push("slug");
      values.push(newSlug);
    }
    if (files?.image?.[0]) {
      fields.push("image_url");
      values.push(files.image[0].location);
    }
    if (files?.icon?.[0]) {
      fields.push("icon_url");
      values.push(files.icon[0].location);
    }

    if (rest.requires_booking_time !== undefined || fields.includes("slug")) {
      const existing = await pool.query(findCategoryById, [req.params.id]);
      if (!existing.rows[0]) throw new AppError("NOT_FOUND", "Category not found", 404);
      const slugIdx = fields.indexOf("slug");
      const effectiveSlug = slugIdx >= 0 ? (values[slugIdx] as string) : existing.rows[0].slug;
      const requestedFlag =
        rest.requires_booking_time !== undefined
          ? Boolean(rest.requires_booking_time)
          : Boolean(existing.rows[0].requires_booking_time);
      const normalizedFlag = normalizeBookingTimeFlag(effectiveSlug, requestedFlag);
      const flagIdx = fields.indexOf("requires_booking_time");
      if (flagIdx >= 0) values[flagIdx] = normalizedFlag;
      else {
        fields.push("requires_booking_time");
        values.push(normalizedFlag);
      }
    }

    let category;
    if (fields.length > 0) {
      const result = await pool.query(updateCategoryQuery(fields), [req.params.id, ...values]);
      category = result.rows[0];
    } else {
      const result = await pool.query(findCategoryById, [req.params.id]);
      category = result.rows[0];
    }
    if (!category) throw new AppError("NOT_FOUND", "Category not found", 404);

    if (Array.isArray(type_ids)) {
      await pool.query(clearCategoryTypes, [req.params.id]);
      if (type_ids.length > 0) {
        await pool.query(setCategoryTypes, [req.params.id, type_ids]);
      }
    }

    return success(res, category, "Category updated");
  } catch (err) {
    next(err);
  }
};

export const deleteCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const linked = await pool.query<{ count: number }>(countServicesByCategory, [req.params.id]);
    if (linked.rows[0].count > 0) {
      throw new AppError("CONFLICT", "Cannot delete category with linked services", 409);
    }

    const result = await pool.query(softDeleteCategory, [req.params.id]);
    if (!result.rows[0]) throw new AppError("NOT_FOUND", "Category not found", 404);

    return success(res, result.rows[0], "Category deleted");
  } catch (err) {
    next(err);
  }
};

export const deleteCategoryPermanently = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const linked = await pool.query<{ count: number }>(countServicesByCategory, [req.params.id]);
    if (linked.rows[0].count > 0) {
      throw new AppError("CONFLICT", "Cannot delete category with linked services", 409);
    }

    const result = await pool.query(hardDeleteCategory, [req.params.id]);
    if (!result.rows[0]) throw new AppError("NOT_FOUND", "Category not found", 404);
    if (result.rows[0].image_url) await deleteFromS3(result.rows[0].image_url);
    if (result.rows[0].icon_url) await deleteFromS3(result.rows[0].icon_url);
    return success(res, result.rows[0], "Category permanently deleted");
  } catch (err) {
    next(err);
  }
};
