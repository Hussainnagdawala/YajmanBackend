import { Request, Response, NextFunction } from "express";
import { pool } from "../config/database";
import { success } from "../utils/response";
import { AppError } from "../utils/errors";
import { paginate } from "../utils/pagination";
import { logger } from "../config/logger";
import { hoursUntil } from "../utils/date";
import { razorpay } from "../config/razorpay";
import {
  listBookings as listBookingsQuery,
  countBookings,
  findBookingDetail,
  findBookingById,
  cancelBooking as cancelBookingQuery,
  findLatestPaymentForOrder,
  freePanditAssignment,
} from "../queries/booking.queries";
import { markPaymentRefunded } from "../queries/payment.queries";
import { updateOrderStatus } from "../queries/order.queries";

const NON_CANCELLABLE_STATUSES = ["completed", "cancelled", "refunded"];
const CANCEL_MIN_HOURS = 24;

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

export const cancelBooking = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orderResult = await pool.query(findBookingById, [req.params.id]);
    const order = orderResult.rows[0];
    if (!order) throw new AppError("NOT_FOUND", "Booking not found", 404);
    if (req.user!.role !== "admin" && order.user_id !== req.user!.id) {
      throw new AppError("FORBIDDEN", "You do not have access to this booking", 403);
    }
    if (NON_CANCELLABLE_STATUSES.includes(order.status)) {
      throw new AppError("VALIDATION_ERROR", `Cannot cancel a booking with status '${order.status}'`, 400);
    }
    if (hoursUntil(new Date(order.booking_datetime)) < CANCEL_MIN_HOURS) {
      throw new AppError("CANCEL_TOO_LATE", "Cannot cancel less than 24 hours before the booking", 400);
    }

    let updatedOrder = (await pool.query(cancelBookingQuery, [req.params.id, req.body.reason, req.user!.id])).rows[0];
    await pool.query(freePanditAssignment, [order.id]);

    const paymentResult = await pool.query(findLatestPaymentForOrder, [order.id]);
    const payment = paymentResult.rows[0];

    if (payment && payment.status === "captured") {
      try {
        const refund = await razorpay.payments.refund(payment.razorpay_payment_id, {
          amount: Math.round(Number(payment.amount) * 100),
        });
        await pool.query(markPaymentRefunded, [payment.id, Number(refund.amount) / 100, refund.id]);
        updatedOrder = (await pool.query(updateOrderStatus, [order.id, "refunded"])).rows[0];
      } catch (err) {
        logger.error("Razorpay refund failed", { err, orderId: order.id, paymentId: payment.id });
      }
    }

    return success(res, updatedOrder, "Booking cancelled");
  } catch (err) {
    next(err);
  }
};
