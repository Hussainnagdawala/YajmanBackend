import { Request, Response, NextFunction } from "express";
import { pool } from "../config/database";
import { success } from "../utils/response";
import { AppError } from "../utils/errors";
import { paginate } from "../utils/pagination";
import { cancelOrderWithRefund } from "../services/booking.service";
import {
  listBookings as listBookingsQuery,
  countBookings,
  findBookingDetail,
  findBookingById,
} from "../queries/booking.queries";

export const listBookings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, page, limit } = req.query as unknown as { status?: string; page: number; limit: number };
    const { limit: safeLimit, offset, meta } = paginate(page, limit);

    const [rows, count] = await Promise.all([
      pool.query(listBookingsQuery(status, 2, 3), [req.user!.id, safeLimit, offset]),
      pool.query<{ count: number }>(countBookings(status), [req.user!.id]),
    ]);

    return success(res, rows.rows, "Bookings fetched", 200, meta(count.rows[0].count));
  } catch (err) {
    next(err);
  }
};

export const getBookingDetail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(findBookingDetail, [req.params.id]);
    const booking = result.rows[0];
    if (!booking) throw new AppError("NOT_FOUND", "Booking not found", 404);
    if (req.user!.role !== "admin" && booking.user_id !== req.user!.id) {
      throw new AppError("FORBIDDEN", "You do not have access to this booking", 403);
    }
    return success(res, booking);
  } catch (err) {
    next(err);
  }
};

const CANCEL_MESSAGES: Record<string, string> = {
  not_applicable: "Booking cancelled",
  success: "Booking cancelled and refund processed",
  failed: "Booking cancelled — refund could not be processed automatically, our team will follow up",
};

export const cancelBooking = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orderResult = await pool.query(findBookingById, [req.params.id]);
    const order = orderResult.rows[0];
    if (!order) throw new AppError("NOT_FOUND", "Booking not found", 404);
    if (req.user!.role !== "admin" && order.user_id !== req.user!.id) {
      throw new AppError("FORBIDDEN", "You do not have access to this booking", 403);
    }

    const { order: updatedOrder, refundOutcome } = await cancelOrderWithRefund(
      order.id,
      req.body.reason,
      req.user!.id,
      { bypassTimeWindow: req.user!.role === "admin" }
    );

    return success(res, updatedOrder, CANCEL_MESSAGES[refundOutcome]);
  } catch (err) {
    next(err);
  }
};
