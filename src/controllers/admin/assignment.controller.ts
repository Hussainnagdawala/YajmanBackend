import { Request, Response, NextFunction } from "express";
import { pool } from "../../config/database";
import { success } from "../../utils/response";
import { AppError } from "../../utils/errors";
import { paginate } from "../../utils/pagination";
import { createNotification } from "../../services/notification.service";
import { notifyPanditAssigned } from "../../services/order-notification.service";
import { assertPanditCapacityAvailable } from "../../services/pandit-availability.service";
import { updateOrderStatus } from "../../queries/order.queries";
import {
  findOrderForAssignment,
  findPanditProfileById,
  createAssignment as createAssignmentQuery,
  findAssignmentById,
  reassignAssignment as reassignAssignmentQuery,
  listAssignmentsAdmin as listAssignmentsAdminQuery,
  countAssignmentsAdmin,
} from "../../queries/pandit.queries";

// Deliberately an allow-list, not a deny-list: assigning a pandit only makes
// sense once payment is actually confirmed. A 'pending' (unpaid) order is
// not assignable even though it isn't in any "closed" status.
const ASSIGNABLE_ORDER_STATUSES = ["confirmed"];
const RESPOND_WINDOW_HOURS = 48;

export const createAssignment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { order_id, pandit_id } = req.body;

    const orderResult = await pool.query(findOrderForAssignment, [order_id]);
    const order = orderResult.rows[0];
    if (!order) throw new AppError("NOT_FOUND", "Order not found", 404);
    if (!ASSIGNABLE_ORDER_STATUSES.includes(order.status)) {
      throw new AppError("VALIDATION_ERROR", `Cannot assign a pandit to an order with status '${order.status}'`, 400);
    }
    if (!order.requires_pandit) {
      throw new AppError("VALIDATION_ERROR", "This order's category does not require pandit assignment", 400);
    }

    const panditResult = await pool.query(findPanditProfileById, [pandit_id]);
    const pandit = panditResult.rows[0];
    if (!pandit) throw new AppError("NOT_FOUND", "Pandit profile not found", 404);
    if (pandit.user_id === order.user_id) {
      throw new AppError("VALIDATION_ERROR", "A pandit cannot be assigned to their own order", 400);
    }

    await assertPanditCapacityAvailable(pandit, order, null);

    const respondBy = new Date(Date.now() + RESPOND_WINDOW_HOURS * 60 * 60 * 1000);
    const assignment = (
      await pool.query(createAssignmentQuery, [order_id, pandit_id, req.user!.id, respondBy])
    ).rows[0];

    await pool.query(updateOrderStatus, [order_id, "pandit_assigned"]);
    await createNotification(
      pandit.user_id,
      "New booking assignment",
      `You have been assigned to order ${order.order_number}. Please respond within 48 hours.`,
      "pandit_assigned",
      "order",
      order_id
    );
    void notifyPanditAssigned(order);

    return success(res, assignment, "Pandit assigned", 201);
  } catch (err) {
    next(err);
  }
};

export const listAssignmentsAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = req.query as unknown as { status?: string; expiring?: boolean; page: number; limit: number };
    const { limit: safeLimit, offset, meta } = paginate(q.page, q.limit);

    const values: unknown[] = [];
    const whereClauses: string[] = [];
    if (q.status) {
      values.push(q.status);
      whereClauses.push(`pa.status = $${values.length}`);
    }
    if (q.expiring) {
      whereClauses.push(`pa.status = 'pending' AND pa.respond_by <= NOW() + INTERVAL '12 hours'`);
    }

    const [rows, count] = await Promise.all([
      pool.query(listAssignmentsAdminQuery(whereClauses, values.length + 1, values.length + 2), [...values, safeLimit, offset]),
      pool.query<{ count: number }>(countAssignmentsAdmin(whereClauses), values),
    ]);

    return success(res, rows.rows, "Assignments fetched", 200, meta(count.rows[0].count));
  } catch (err) {
    next(err);
  }
};

export const reassignPandit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const assignmentResult = await pool.query(findAssignmentById, [req.params.id]);
    const assignment = assignmentResult.rows[0];
    if (!assignment) throw new AppError("NOT_FOUND", "Assignment not found", 404);

    const { pandit_id } = req.body;
    const panditResult = await pool.query(findPanditProfileById, [pandit_id]);
    const pandit = panditResult.rows[0];
    if (!pandit) throw new AppError("NOT_FOUND", "Pandit profile not found", 404);

    const orderResult = await pool.query(findOrderForAssignment, [assignment.order_id]);
    const order = orderResult.rows[0];
    if (!order.requires_pandit) {
      throw new AppError("VALIDATION_ERROR", "This order's category does not require pandit assignment", 400);
    }
    if (!["pandit_assigned", "in_progress"].includes(order.status)) {
      throw new AppError("VALIDATION_ERROR", `Cannot reassign a pandit for an order with status '${order.status}'`, 400);
    }
    if (pandit.user_id === order.user_id) {
      throw new AppError("VALIDATION_ERROR", "A pandit cannot be assigned to their own order", 400);
    }

    await assertPanditCapacityAvailable(pandit, order, assignment.id);

    const respondBy = new Date(Date.now() + RESPOND_WINDOW_HOURS * 60 * 60 * 1000);
    const updated = (await pool.query(reassignAssignmentQuery, [req.params.id, pandit_id, respondBy])).rows[0];

    await pool.query(updateOrderStatus, [order.id, "pandit_assigned"]);
    await createNotification(
      pandit.user_id,
      "New booking assignment",
      `You have been assigned to order ${order.order_number}. Please respond within 48 hours.`,
      "pandit_assigned",
      "order",
      order.id
    );
    void notifyPanditAssigned(order);

    return success(res, updated, "Pandit reassigned");
  } catch (err) {
    next(err);
  }
};
