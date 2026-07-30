import { Request, Response, NextFunction } from "express";
import { pool } from "../config/database";
import { success } from "../utils/response";
import { AppError } from "../utils/errors";
import { generateUniqueSlug } from "../services/slug.service";
import {
  listActiveTags,
  listAllTags,
  findTagById,
  createTag as createTagQuery,
  updateTag as updateTagQuery,
  softDeleteTag,
  hardDeleteTag,
} from "../queries/category.queries";

export const listTags = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(listActiveTags);
    return success(res, result.rows);
  } catch (err) {
    next(err);
  }
};

export const listTagsAdmin = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(listAllTags);
    return success(res, result.rows);
  } catch (err) {
    next(err);
  }
};

export const createTag = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, color, bg_color, display_order } = req.body;
    const slug = await generateUniqueSlug(name, "tags");

    const result = await pool.query(createTagQuery, [name, slug, color ?? null, bg_color ?? null, display_order ?? 0]);
    return success(res, result.rows[0], "Tag created", 201);
  } catch (err) {
    next(err);
  }
};

export const updateTag = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fields: string[] = [];
    const values: unknown[] = [];

    for (const [key, value] of Object.entries(req.body)) {
      fields.push(key);
      values.push(value);
    }
    if (fields.includes("name")) {
      const newSlug = await generateUniqueSlug(req.body.name, "tags", req.params.id);
      fields.push("slug");
      values.push(newSlug);
    }

    if (fields.length === 0) throw new AppError("VALIDATION_ERROR", "No fields to update", 400);

    const result = await pool.query(updateTagQuery(fields), [req.params.id, ...values]);
    if (!result.rows[0]) throw new AppError("NOT_FOUND", "Tag not found", 404);
    return success(res, result.rows[0], "Tag updated");
  } catch (err) {
    next(err);
  }
};

export const deleteTag = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(softDeleteTag, [req.params.id]);
    if (!result.rows[0]) throw new AppError("NOT_FOUND", "Tag not found", 404);
    return success(res, result.rows[0], "Tag deleted");
  } catch (err) {
    next(err);
  }
};

export const deleteTagPermanently = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(hardDeleteTag, [req.params.id]);
    if (!result.rows[0]) throw new AppError("NOT_FOUND", "Tag not found", 404);
    return success(res, result.rows[0], "Tag permanently deleted");
  } catch (err) {
    next(err);
  }
};
