import { Request, Response, NextFunction } from "express";
import { pool } from "../config/database";
import { success } from "../utils/response";
import { AppError } from "../utils/errors";
import { paginate } from "../utils/pagination";
import { findServiceWithCategory } from "../queries/service.queries";
import {
  createGeneralContactEntry,
  createServiceInquiryEntry,
  createAayojanContactEntry,
  listContactEntriesAdmin as listContactEntriesAdminQuery,
  countContactEntriesAdmin,
  updateContactEntry as updateContactEntryQuery,
} from "../queries/contact.queries";

export const createContact = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, phone, city, message } = req.body;
    const result = await pool.query(createGeneralContactEntry, [name, email ?? null, phone, city ?? null, message ?? null]);
    return success(res, result.rows[0], "Contact form submitted", 201);
  } catch (err) {
    next(err);
  }
};

export const createServiceInquiry = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const serviceResult = await pool.query(findServiceWithCategory, [req.params.id]);
    const service = serviceResult.rows[0];
    if (!service) throw new AppError("NOT_FOUND", "Service not found", 404);

    const { name, email, phone, message, birth_date, birth_time, birth_place } = req.body;
    const result = await pool.query(createServiceInquiryEntry, [
      name, email ?? null, phone, message ?? null, service.id, service.title, service.category_id, service.category_name,
      birth_date ?? null, birth_time ?? null, birth_place ?? null,
    ]);
    return success(res, result.rows[0], "Inquiry submitted", 201);
  } catch (err) {
    next(err);
  }
};

export const createAayojanContact = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, phone, city, event_name, number_of_people, preferred_date } = req.body;
    const result = await pool.query(createAayojanContactEntry, [
      name, email ?? null, phone, city ?? null, event_name ?? null, number_of_people ?? null, preferred_date ?? null,
    ]);
    return success(res, result.rows[0], "Contact form submitted", 201);
  } catch (err) {
    next(err);
  }
};

export const listContactEntriesAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { form_type, status, page, limit } = req.query as unknown as {
      form_type?: string;
      status?: string;
      page: number;
      limit: number;
    };
    const { limit: safeLimit, offset, meta } = paginate(page, limit);

    const values: unknown[] = [];
    const whereClauses: string[] = [];
    if (form_type) {
      values.push(form_type);
      whereClauses.push(`form_type = $${values.length}`);
    }
    if (status) {
      values.push(status);
      whereClauses.push(`status = $${values.length}`);
    }

    const [rows, count] = await Promise.all([
      pool.query(listContactEntriesAdminQuery(whereClauses, values.length + 1, values.length + 2), [...values, safeLimit, offset]),
      pool.query<{ count: number }>(countContactEntriesAdmin(whereClauses), values),
    ]);

    return success(res, rows.rows, "Contact entries fetched", 200, meta(count.rows[0].count));
  } catch (err) {
    next(err);
  }
};

export const updateContactEntryAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fields = Object.keys(req.body);
    if (fields.length === 0) throw new AppError("VALIDATION_ERROR", "No fields to update", 400);

    const values = fields.map((f) => req.body[f]);
    const result = await pool.query(updateContactEntryQuery(fields), [req.params.id, ...values]);
    if (!result.rows[0]) throw new AppError("NOT_FOUND", "Contact entry not found", 404);
    return success(res, result.rows[0], "Contact entry updated");
  } catch (err) {
    next(err);
  }
};
