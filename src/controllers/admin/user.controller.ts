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
  listAdminUserIds,
} from "../../queries/user.queries";
import { freeAssignmentsForSuspendedPandit } from "../../queries/pandit.queries";
import { createNotification } from "../../services/notification.service";

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
    const user = result.rows[0];
    if (!user) throw new AppError("NOT_FOUND", "User not found", 404);

    // Suspending/deactivating a pandit shouldn't leave work assigned to someone
    // who can no longer log in to respond — free it up for reassignment.
    if (user.role === "pandit" && user.status !== "active") {
      const freed = await pool.query<{ id: string; order_id: string; order_number: string }>(
        freeAssignmentsForSuspendedPandit,
        [user.id]
      );
      if (freed.rows.length > 0) {
        const admins = await pool.query<{ id: string }>(listAdminUserIds);
        for (const row of freed.rows) {
          for (const admin of admins.rows) {
            await createNotification(
              admin.id,
              "Pandit deactivated — reassignment needed",
              `${user.name ?? user.phone} was deactivated while assigned to order ${row.order_number}. Please reassign a pandit.`,
              "pandit_assigned",
              "order",
              row.order_id
            );
          }
        }
      }
    }

    return success(res, user, "User status updated");
  } catch (err) {
    next(err);
  }
};
