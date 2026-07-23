import { Request, Response, NextFunction } from "express";
import { pool } from "../config/database";
import { success } from "../utils/response";
import { AppError } from "../utils/errors";
import { paginate } from "../utils/pagination";
import { createNotification } from "../services/notification.service";
import { recalculatePanditStats } from "../services/stats.service";
import { findUserById, listAdminUserIds } from "../queries/user.queries";
import { findBookingById } from "../queries/booking.queries";
import { completeOrder } from "../queries/order.queries";
import {
  findPanditProfileByUserId,
  createPanditProfile,
  updatePanditProfile as updatePanditProfileQuery,
  findAssignmentForPandit,
  updateAssignmentAccept,
  updateAssignmentReject,
  isPanditDoubleBooked,
  findOrderForAssignment,
  listAssignmentsForPandit,
  countAssignmentsForPandit,
  findAssignmentDetailForPandit,
  listPanditBookings,
  countPendingAssignments,
  countTodayBookings,
  listUpcomingBookings,
  findAcceptedAssignmentForPanditByOrder,
  completeAssignmentForOrder,
} from "../queries/pandit.queries";

const ASSIGNMENT_STATUSES = ["pending", "accepted", "rejected", "expired", "completed"];

const getOrCreatePanditProfile = async (userId: string) => {
  const existing = await pool.query(findPanditProfileByUserId, [userId]);
  if (existing.rows[0]) return existing.rows[0];

  const userResult = await pool.query(findUserById, [userId]);
  const user = userResult.rows[0];
  const displayName = user?.name ?? user?.phone ?? "Pandit";

  const created = await pool.query(createPanditProfile, [userId, displayName]);
  return created.rows[0];
};

const notifyAllAdmins = async (title: string, body: string, referenceId: string) => {
  const admins = await pool.query<{ id: string }>(listAdminUserIds);
  for (const admin of admins.rows) {
    await createNotification(admin.id, title, body, "booking_update", "order", referenceId);
  }
};

// ─── Profile ─────────────────────────────────────────────────

export const getProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await getOrCreatePanditProfile(req.user!.id);
    return success(res, profile);
  } catch (err) {
    next(err);
  }
};

export const updateProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await getOrCreatePanditProfile(req.user!.id);
    const fields = Object.keys(req.body);
    if (fields.length === 0) throw new AppError("VALIDATION_ERROR", "No fields to update", 400);

    const values = fields.map((f) => req.body[f]);
    const result = await pool.query(updatePanditProfileQuery(fields), [profile.id, ...values]);
    return success(res, result.rows[0], "Profile updated");
  } catch (err) {
    next(err);
  }
};

// ─── Dashboard ───────────────────────────────────────────────

export const getDashboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await getOrCreatePanditProfile(req.user!.id);

    const [pending, today, upcoming] = await Promise.all([
      pool.query<{ count: number }>(countPendingAssignments, [profile.id]),
      pool.query<{ count: number }>(countTodayBookings, [profile.id]),
      pool.query(listUpcomingBookings, [profile.id]),
    ]);

    return success(res, {
      pending_assignments_count: pending.rows[0].count,
      today_bookings_count: today.rows[0].count,
      upcoming_bookings: upcoming.rows,
      stats: {
        total_completed: profile.total_bookings,
        rating_avg: Number(profile.rating_avg),
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── Assignments ─────────────────────────────────────────────

export const listAssignments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await getOrCreatePanditProfile(req.user!.id);
    const { status, page, limit } = req.query as unknown as { status?: string; page: number; limit: number };
    const { limit: safeLimit, offset, meta } = paginate(page, limit);

    const values: unknown[] = [profile.id];
    const whereClauses: string[] = [];
    if (status && ASSIGNMENT_STATUSES.includes(status)) {
      values.push(status);
      whereClauses.push(`pa.status = $${values.length}`);
    }

    const [rows, count] = await Promise.all([
      pool.query(listAssignmentsForPandit(whereClauses, values.length + 1, values.length + 2), [...values, safeLimit, offset]),
      pool.query<{ count: number }>(countAssignmentsForPandit(whereClauses), values),
    ]);

    return success(res, rows.rows, "Assignments fetched", 200, meta(count.rows[0].count));
  } catch (err) {
    next(err);
  }
};

export const getAssignmentDetail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(findAssignmentDetailForPandit, [req.params.id, req.user!.id]);
    if (!result.rows[0]) throw new AppError("NOT_FOUND", "Assignment not found", 404);
    return success(res, result.rows[0]);
  } catch (err) {
    next(err);
  }
};

export const acceptAssignment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const assignmentResult = await pool.query(findAssignmentForPandit, [req.params.id, req.user!.id]);
    const assignment = assignmentResult.rows[0];
    if (!assignment) throw new AppError("NOT_FOUND", "Assignment not found", 404);
    if (assignment.status !== "pending") {
      throw new AppError("VALIDATION_ERROR", `Cannot accept an assignment with status '${assignment.status}'`, 400);
    }
    if (new Date(assignment.respond_by) < new Date()) {
      throw new AppError("VALIDATION_ERROR", "The 48-hour response window for this assignment has expired", 400);
    }

    const orderResult = await pool.query(findOrderForAssignment, [assignment.order_id]);
    const order = orderResult.rows[0];

    const conflict = await pool.query(isPanditDoubleBooked, [
      assignment.pandit_id, order.booking_date, order.booking_time, assignment.id,
    ]);
    if (conflict.rows.length > 0) {
      throw new AppError("CONFLICT", "You already have an accepted booking at this date and time", 409);
    }

    const updated = await pool.query(updateAssignmentAccept, [req.params.id, req.body.notes ?? null]);

    await createNotification(
      order.user_id, "Pandit assigned", "A pandit has accepted your booking.", "booking_update", "order", order.id
    );
    await notifyAllAdmins("Assignment accepted", `Pandit accepted assignment for order ${order.order_number}.`, order.id);

    return success(res, updated.rows[0], "Assignment accepted");
  } catch (err) {
    next(err);
  }
};

export const rejectAssignment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const assignmentResult = await pool.query(findAssignmentForPandit, [req.params.id, req.user!.id]);
    const assignment = assignmentResult.rows[0];
    if (!assignment) throw new AppError("NOT_FOUND", "Assignment not found", 404);
    if (assignment.status !== "pending") {
      throw new AppError("VALIDATION_ERROR", `Cannot reject an assignment with status '${assignment.status}'`, 400);
    }

    const updated = await pool.query(updateAssignmentReject, [req.params.id, req.body.reason]);

    const orderResult = await pool.query(findOrderForAssignment, [assignment.order_id]);
    const order = orderResult.rows[0];
    await notifyAllAdmins(
      "Assignment rejected — reassignment needed",
      `Pandit rejected assignment for order ${order.order_number}: ${req.body.reason}`,
      order.id
    );

    return success(res, updated.rows[0], "Assignment rejected");
  } catch (err) {
    next(err);
  }
};

// ─── Bookings ────────────────────────────────────────────────

export const listBookingsByDate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await getOrCreatePanditProfile(req.user!.id);
    const { date } = req.query as { date?: string };

    const result = await pool.query(listPanditBookings(!!date), date ? [profile.id, date] : [profile.id]);
    return success(res, result.rows);
  } catch (err) {
    next(err);
  }
};

export const markBookingComplete = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orderResult = await pool.query(findBookingById, [req.params.id]);
    const order = orderResult.rows[0];
    if (!order) throw new AppError("NOT_FOUND", "Booking not found", 404);

    if (req.user!.role === "pandit") {
      const assignment = await pool.query(findAcceptedAssignmentForPanditByOrder, [order.id, req.user!.id]);
      if (!assignment.rows[0]) {
        throw new AppError("FORBIDDEN", "You are not assigned to this booking", 403);
      }
    }
    if (["completed", "cancelled", "refunded"].includes(order.status)) {
      throw new AppError("VALIDATION_ERROR", `Cannot complete a booking with status '${order.status}'`, 400);
    }

    const updated = await pool.query(completeOrder, [order.id]);
    const completedAssignment = await pool.query(completeAssignmentForOrder, [order.id]);
    if (completedAssignment.rows[0]) {
      await recalculatePanditStats(completedAssignment.rows[0].pandit_id);
    }

    await createNotification(
      order.user_id,
      "Booking completed",
      "Your booking has been marked as completed. We'd love your feedback!",
      "booking_update",
      "order",
      order.id
    );

    return success(res, updated.rows[0], "Booking marked as completed");
  } catch (err) {
    next(err);
  }
};
