import { Request, Response, NextFunction } from "express";
import DOMPurify from "isomorphic-dompurify";
import { pool } from "../config/database";
import { success } from "../utils/response";
import { AppError } from "../utils/errors";
import {
  listActiveLegalPages,
  findActiveLegalPageBySlug,
  listAllLegalPagesAdmin,
  findLegalPageByIdAdmin,
  updateLegalPage as updateLegalPageQuery,
} from "../queries/legal.queries";
import { generateUniqueSlug } from "../services/slug.service";

// ─── Public ─────────────────────────────────────────────────

export const listLegalPages = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(listActiveLegalPages);
    return success(res, result.rows);
  } catch (err) {
    next(err);
  }
};

export const getLegalPage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(findActiveLegalPageBySlug, [req.params.slug]);
    if (!result.rows[0]) throw new AppError("NOT_FOUND", "Page not found", 404);
    return success(res, result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// ─── Admin ──────────────────────────────────────────────────

export const listLegalPagesAdmin = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(listAllLegalPagesAdmin);
    return success(res, result.rows);
  } catch (err) {
    next(err);
  }
};

export const getLegalPageAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(findLegalPageByIdAdmin, [req.params.id]);
    if (!result.rows[0]) throw new AppError("NOT_FOUND", "Page not found", 404);
    return success(res, result.rows[0]);
  } catch (err) {
    next(err);
  }
};

export const updateLegalPageAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, content, meta_title, meta_description, is_active } = req.body;

    const fields: string[] = [];
    const values: unknown[] = [];
    const push = (field: string, value: unknown) => {
      fields.push(field);
      values.push(value);
    };

    if (title !== undefined) {
      push("title", title);
      const newSlug = await generateUniqueSlug(title, "legal_pages", req.params.id);
      push("slug", newSlug);
    }
    if (content !== undefined) push("content", DOMPurify.sanitize(content));
    if (meta_title !== undefined) push("meta_title", meta_title);
    if (meta_description !== undefined) push("meta_description", meta_description);
    if (is_active !== undefined) push("is_active", is_active);
    push("updated_by", req.user!.id);

    const result = await pool.query(updateLegalPageQuery(fields), [req.params.id, ...values]);
    if (!result.rows[0]) throw new AppError("NOT_FOUND", "Page not found", 404);

    return success(res, result.rows[0], "Page updated");
  } catch (err) {
    next(err);
  }
};
