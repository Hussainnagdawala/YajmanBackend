import { pool } from "../config/database";
import { AppError } from "../utils/errors";
import { logger } from "../config/logger";
import { razorpay } from "../config/razorpay";
import { toISTDateTime, hoursUntil, isPast } from "../utils/date";
import { countOrdersToday, findDuplicateBooking } from "../queries/order.queries";
import { findBookingById, finalizeCancellation, findLatestPaymentForOrder, freePanditAssignment } from "../queries/booking.queries";
import { markPaymentRefunded } from "../queries/payment.queries";
import { insertActivityLog } from "../queries/settings.queries";
import { notifyBookingCancelled } from "./order-notification.service";

export const computeBookingDateTime = (bookingDate: string, bookingTime: string, advanceBookingDays: number): Date => {
  const bookingDateTime = toISTDateTime(bookingDate, bookingTime);

  if (isPast(bookingDateTime)) {
    throw new AppError("VALIDATION_ERROR", "Booking date cannot be in the past", 400, [
      { field: "booking_date", message: "Please choose a future date for your booking" },
    ]);
  }
  const minAdvanceHours = advanceBookingDays * 24;
  if (hoursUntil(bookingDateTime) < minAdvanceHours) {
    throw new AppError("BOOKING_TOO_CLOSE", `Booking must be at least ${advanceBookingDays} day(s) in advance`, 400, [
      { field: "booking_date", message: `Please book at least ${advanceBookingDays} day(s) before the service date` },
    ]);
  }

  return bookingDateTime;
};

export const assertNoDuplicateBooking = async (
  userId: string,
  serviceId: string,
  bookingDate: string
): Promise<void> => {
  const existing = await pool.query(findDuplicateBooking, [userId, serviceId, bookingDate]);
  if (existing.rows.length > 0) {
    throw new AppError("CONFLICT", "You already have a booking for this service on this date", 409);
  }
};

export const generateOrderNumber = async (): Promise<string> => {
  const result = await pool.query<{ count: number }>(countOrdersToday);
  const seq = result.rows[0].count + 1;

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");

  return `YAJ${yyyy}${mm}${dd}${String(seq).padStart(2, "0")}`;
};

// Best-effort audit trail — a logging failure must never break the
// user-facing response, so failures are swallowed here (same pattern as
// app-settings.service.ts's logSettingActivity).
export const logOrderActivity = async (
  userId: string | undefined,
  action: string,
  orderId: string,
  details?: { description?: string; oldData?: unknown; newData?: unknown }
): Promise<void> => {
  try {
    await pool.query(insertActivityLog, [
      userId ?? null,
      action,
      "order",
      orderId,
      details?.oldData ? JSON.stringify(details.oldData) : null,
      JSON.stringify({ ...(typeof details?.newData === "object" ? details.newData : {}), description: details?.description }),
      null,
      null,
    ]);
  } catch (err) {
    logger.error("Failed to write order activity log", { err, action, orderId });
  }
};

const ORDER_STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ["payment_failed"],
  confirmed: ["pandit_assigned", "in_progress", "completed", "disputed"],
  pandit_assigned: ["in_progress", "completed", "disputed"],
  in_progress: ["completed", "disputed"],
  completed: ["disputed"],
  cancelled: [],
  refunded: [],
  payment_failed: [],
  refund_failed: [],
  disputed: [],
};

export const assertValidStatusTransition = (currentStatus: string, nextStatus: string): void => {
  const allowed = ORDER_STATUS_TRANSITIONS[currentStatus] ?? [];
  if (!allowed.includes(nextStatus)) {
    throw new AppError(
      "INVALID_STATUS_TRANSITION",
      `Cannot move an order from '${currentStatus}' to '${nextStatus}'`,
      409
    );
  }
};

const NON_CANCELLABLE_STATUSES = ["completed", "cancelled", "refunded", "payment_failed", "refund_failed", "disputed"];
const CANCEL_MIN_HOURS = 24;

export type RefundOutcome = "not_applicable" | "success" | "failed";

// Shared by both the customer cancel endpoint and the admin cancel endpoint.
// Attempts the Razorpay refund BEFORE writing any terminal status, so a
// refund failure never gets silently reported to the caller as "cancelled".
export const cancelOrderWithRefund = async (
  orderId: string,
  reason: string,
  cancelledByUserId: string,
  options?: { bypassTimeWindow?: boolean }
): Promise<{ order: Record<string, unknown>; refundOutcome: RefundOutcome }> => {
  const orderResult = await pool.query(findBookingById, [orderId]);
  const order = orderResult.rows[0];
  if (!order) throw new AppError("NOT_FOUND", "Booking not found", 404);

  if (NON_CANCELLABLE_STATUSES.includes(order.status)) {
    throw new AppError("VALIDATION_ERROR", `Cannot cancel a booking with status '${order.status}'`, 400);
  }
  if (!options?.bypassTimeWindow && hoursUntil(new Date(order.booking_datetime)) < CANCEL_MIN_HOURS) {
    throw new AppError("CANCEL_TOO_LATE", "Cannot cancel less than 24 hours before the booking", 400);
  }

  const paymentResult = await pool.query(findLatestPaymentForOrder, [orderId]);
  const payment = paymentResult.rows[0];

  let finalStatus: "cancelled" | "refunded" | "refund_failed" = "cancelled";
  let refundOutcome: RefundOutcome = "not_applicable";

  if (payment && payment.status === "captured") {
    try {
      const refund = await razorpay.payments.refund(payment.razorpay_payment_id, {
        amount: Math.round(Number(payment.amount) * 100),
      });
      await pool.query(markPaymentRefunded, [payment.id, Number(refund.amount) / 100, refund.id]);
      finalStatus = "refunded";
      refundOutcome = "success";
    } catch (err) {
      logger.error("Razorpay refund failed", { err, orderId, paymentId: payment.id });
      finalStatus = "refund_failed";
      refundOutcome = "failed";
    }
  }

  await pool.query(freePanditAssignment, [orderId]);
  const updatedOrder = (await pool.query(finalizeCancellation, [orderId, finalStatus, reason, cancelledByUserId])).rows[0];

  await logOrderActivity(cancelledByUserId, "cancel_order", orderId, {
    description: `Order cancelled (refund: ${refundOutcome}): ${reason}`,
    oldData: { status: order.status },
    newData: { status: finalStatus },
  });

  // Fires for both the customer cancel endpoint and the admin cancel endpoint —
  // always addressed to the booking owner, not the actor.
  void notifyBookingCancelled(updatedOrder, refundOutcome);

  return { order: updatedOrder, refundOutcome };
};
