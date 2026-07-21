import { Request, Response, NextFunction } from "express";
import { pool } from "../../config/database";
import { success } from "../../utils/response";
import { AppError } from "../../utils/errors";
import { paginate } from "../../utils/pagination";
import {
  createUserByAdmin,
  findUserById,
  updateProfile as updateUserQuery,
  updateUserStatus as updateUserStatusQuery,
  listUsers,
  countUsers,
} from "../../queries/user.queries";

export const createUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone, name, role, email } = req.body;
    const result = await pool.query(createUserByAdmin, [phone, name, email ?? null, role]);
    return success(res, result.rows[0], "User created", 201);
  } catch (err) {
    next(err);
  }
};

export const listAllUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, search, role, status } = req.query as unknown as {
      page: number;
      limit: number;
      search?: string;
      role?: string;
      status?: string;
    };

    const { limit: safeLimit, offset, meta } = paginate(page, limit);
    const filterValues: unknown[] = [];
    const whereClauses: string[] = [];

    if (role) {
      filterValues.push(role);
      whereClauses.push(`role = $${filterValues.length}`);
    }
    if (status) {
      filterValues.push(status);
      whereClauses.push(`status = $${filterValues.length}`);
    }
    if (search) {
      filterValues.push(`%${search}%`);
      whereClauses.push(
        `(name ILIKE $${filterValues.length} OR phone ILIKE $${filterValues.length} OR email ILIKE $${filterValues.length})`
      );
    }

    const [rows, count] = await Promise.all([
      pool.query(
        listUsers(whereClauses, filterValues.length + 1, filterValues.length + 2),
        [...filterValues, safeLimit, offset]
      ),
      pool.query<{ count: number }>(countUsers(whereClauses), filterValues),
    ]);

    return success(res, rows.rows, "Users fetched", 200, meta(count.rows[0].count));
  } catch (err) {
    next(err);
  }
};

export const getUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(findUserById, [req.params.id]);
    if (!result.rows[0]) throw new AppError("NOT_FOUND", "User not found", 404);
    return success(res, result.rows[0]);
  } catch (err) {
    next(err);
  }
};

export const updateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fields = Object.keys(req.body);
    if (fields.length === 0) throw new AppError("VALIDATION_ERROR", "No fields to update", 400);

    const values = fields.map((f) => req.body[f]);
    const result = await pool.query(updateUserQuery(fields), [req.params.id, ...values]);
    if (!result.rows[0]) throw new AppError("NOT_FOUND", "User not found", 404);
    return success(res, result.rows[0], "User updated");
  } catch (err) {
    next(err);
  }
};

export const updateUserStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(updateUserStatusQuery, [req.params.id, req.body.status]);
    if (!result.rows[0]) throw new AppError("NOT_FOUND", "User not found", 404);
    return success(res, result.rows[0], "User status updated");
  } catch (err) {
    next(err);
  }
};
