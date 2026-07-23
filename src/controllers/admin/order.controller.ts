import { Request, Response, NextFunction } from "express";
import { pool } from "../../config/database";
import { success } from "../../utils/response";
import { AppError } from "../../utils/errors";
import { paginate } from "../../utils/pagination";
import {
  listOrdersAdmin as listOrdersAdminQuery,
  countOrdersAdmin,
  findOrderDetailAdmin,
  updateOrderStatusAdmin as updateOrderStatusAdminQuery,
} from "../../queries/order.queries";

export const listOrdersAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = req.query as unknown as {
      status?: string;
      from?: string;
      to?: string;
      search?: string;
      page: number;
      limit: number;
    };
    const { limit: safeLimit, offset, meta } = paginate(q.page, q.limit);

    const values: unknown[] = [];
    const whereClauses: string[] = [];
    if (q.status && q.status !== "all") {
      values.push(q.status);
      whereClauses.push(`o.status = $${values.length}`);
    }
    if (q.from) {
      values.push(q.from);
      whereClauses.push(`o.created_at >= $${values.length}`);
    }
    if (q.to) {
      values.push(q.to);
      whereClauses.push(`o.created_at <= $${values.length}::date + INTERVAL '1 day'`);
    }
    if (q.search) {
      values.push(`%${q.search}%`);
      whereClauses.push(`(o.order_number ILIKE $${values.length} OR o.customer_name ILIKE $${values.length} OR o.customer_phone ILIKE $${values.length})`);
    }

    const [rows, count] = await Promise.all([
      pool.query(listOrdersAdminQuery(whereClauses, values.length + 1, values.length + 2), [...values, safeLimit, offset]),
      pool.query<{ count: number }>(countOrdersAdmin(whereClauses), values),
    ]);

    return success(res, rows.rows, "Orders fetched", 200, meta(count.rows[0].count));
  } catch (err) {
    next(err);
  }
};

export const getOrderDetailAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(findOrderDetailAdmin, [req.params.id]);
    if (!result.rows[0]) throw new AppError("NOT_FOUND", "Order not found", 404);
    return success(res, result.rows[0]);
  } catch (err) {
    next(err);
  }
};

export const updateOrderStatusAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, notes } = req.body;
    const result = await pool.query(updateOrderStatusAdminQuery, [req.params.id, status, notes ?? null]);
    if (!result.rows[0]) throw new AppError("NOT_FOUND", "Order not found", 404);
    return success(res, result.rows[0], "Order status updated");
  } catch (err) {
    next(err);
  }
};
