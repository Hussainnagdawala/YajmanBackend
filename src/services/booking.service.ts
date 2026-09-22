import { pool } from "../config/database";
import { AppError } from "../utils/errors";
import { logger } from "../config/logger";
import { razorpay } from "../config/razorpay";
import { toISTDateTime, hoursUntil, isPast } from "../utils/date";
import { countOrdersToday, findDuplicateBooking } from "../queries/order.queries";
import {
  findBookingByIdForUpdate,
  finalizeCancellation,
  findLatestPaymentForOrder,
  freePanditAssignment,
} from "../queries/booking.queries";
import { markPaymentRefunded } from "../queries/payment.queries";
import { deleteCouponUsage, decrementCouponUsageCount } from "../queries/coupon.queries";
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
//
// The order row is locked (FOR UPDATE) for the whole operation, including
// the Razorpay call — otherwise two near-simultaneous cancels (double-click,
// or customer + admin racing) could both pass the cancellable-status check
// before either writes, firing two refunds for the same payment. Cancel is
// low-frequency, so holding the lock across the external call is an
// acceptable tradeoff for that correctness guarantee.
export const cancelOrderWithRefund = async (
  orderId: string,
  reason: string,
  cancelledByUserId: string,
  options?: { bypassTimeWindow?: boolean }
): Promise<{ order: Record<string, unknown>; refundOutcome: RefundOutcome }> => {
  const client = await pool.connect();
  let updatedOrder: any; // pg row shape from finalizeCancellation's RETURNING *
  let refundOutcome: RefundOutcome;
  let previousStatus: string;

  try {
    await client.query("BEGIN");

    const orderResult = await client.query(findBookingByIdForUpdate, [orderId]);
    const order = orderResult.rows[0];
    if (!order) throw new AppError("NOT_FOUND", "Booking not found", 404);
    previousStatus = order.status;

    if (NON_CANCELLABLE_STATUSES.includes(order.status)) {
      throw new AppError("VALIDATION_ERROR", `Cannot cancel a booking with status '${order.status}'`, 400);
    }
    if (!options?.bypassTimeWindow && hoursUntil(new Date(order.booking_datetime)) < CANCEL_MIN_HOURS) {
      throw new AppError("CANCEL_TOO_LATE", "Cannot cancel less than 24 hours before the booking", 400);
    }

    const paymentResult = await client.query(findLatestPaymentForOrder, [orderId]);
    const payment = paymentResult.rows[0];

    let finalStatus: "cancelled" | "refunded" | "refund_failed" = "cancelled";
    refundOutcome = "not_applicable";

    if (payment && payment.status === "captured") {
      try {
        const refund = await razorpay.payments.refund(payment.razorpay_payment_id, {
          amount: Math.round(Number(payment.amount) * 100),
        });
        await client.query(markPaymentRefunded, [payment.id, Number(refund.amount) / 100, refund.id]);
        finalStatus = "refunded";
        refundOutcome = "success";
      } catch (err) {
        logger.error("Razorpay refund failed", { err, orderId, paymentId: payment.id });
        finalStatus = "refund_failed";
        refundOutcome = "failed";
      }
    }

    await client.query(freePanditAssignment, [orderId]);
    updatedOrder = (await client.query(finalizeCancellation, [orderId, finalStatus, reason, cancelledByUserId])).rows[0];

    // Only release the coupon's usage slot once the refund actually went
    // through — not on plain 'cancelled' (no captured payment, so the usage
    // was never recorded) and not on 'refund_failed' (money hasn't actually
    // been returned yet; a later retry may still succeed).
    if (finalStatus === "refunded" && order.coupon_id) {
      await client.query(deleteCouponUsage, [orderId]);
      await client.query(decrementCouponUsageCount, [order.coupon_id]);
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  await logOrderActivity(cancelledByUserId, "cancel_order", orderId, {
    description: `Order cancelled (refund: ${refundOutcome}): ${reason}`,
    oldData: { status: previousStatus },
    newData: { status: updatedOrder.status },
  });

  // Fires for both the customer cancel endpoint and the admin cancel endpoint —
  // always addressed to the booking owner, not the actor.
  void notifyBookingCancelled(updatedOrder, refundOutcome);

  return { order: updatedOrder, refundOutcome };
};
