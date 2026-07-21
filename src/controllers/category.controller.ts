import { Request, Response, NextFunction } from "express";
import { pool } from "../config/database";
import { success } from "../utils/response";
import { AppError } from "../utils/errors";
import { generateUniqueSlug } from "../services/slug.service";
import {
  listActiveCategories,
  listAllCategories,
  findCategoryById,
  createCategory as createCategoryQuery,
  updateCategory as updateCategoryQuery,
  softDeleteCategory,
  countServicesByCategory,
  setCategoryTypes,
  clearCategoryTypes,
} from "../queries/category.queries";

type MulterS3Files = Record<string, Express.MulterS3.File[]>;

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
    const { name, description, type_ids, display_order, meta_title, meta_description } = req.body;
    const files = req.files as MulterS3Files | undefined;
    const imageUrl = files?.image?.[0]?.location ?? null;
    const iconUrl = files?.icon?.[0]?.location ?? null;

    const slug = await generateUniqueSlug(name, "categories");

    const result = await pool.query(createCategoryQuery, [
      name,
      slug,
      description ?? null,
      imageUrl,
      iconUrl,
      display_order ?? 0,
      meta_title ?? null,
      meta_description ?? null,
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
