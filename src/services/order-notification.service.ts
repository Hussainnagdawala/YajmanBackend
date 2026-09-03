// order-notification.service.ts
// Customer-facing notifications for the booking lifecycle. Each function is a
// thin wrapper over createNotification (which is itself best-effort — it writes
// the inbox row and fires a push, swallowing its own errors), so callers can
// `void` these without worrying about breaking the request flow.
//
// reference_type is always "order" and reference_id the order id; deep_link
// points the app/website at the booking detail screen.

import { createNotification } from "./notification.service";
import type { RefundOutcome } from "./booking.service";

export interface OrderNotificationTarget {
  id: string;
  user_id: string;
  order_number: string;
}

const bookingLink = (orderId: string): string => `/profile/bookings/${orderId}`;

const notify = (
  order: OrderNotificationTarget,
  title: string,
  body: string,
  type: "booking_update" | "payment" | "pandit_assigned"
): Promise<void> =>
  createNotification(order.user_id, title, body, type, "order", order.id, bookingLink(order.id));

export const notifyBookingCreated = (order: OrderNotificationTarget): Promise<void> =>
  notify(
    order,
    "Booking created",
    `Booking ${order.order_number} has been created. Complete the payment to confirm it.`,
    "booking_update"
  );

export const notifyBookingConfirmed = (order: OrderNotificationTarget): Promise<void> =>
  notify(
    order,
    "Booking confirmed",
    `Payment received — booking ${order.order_number} is confirmed. A pandit will be assigned shortly.`,
    "booking_update"
  );

export const notifyPaymentFailed = (order: OrderNotificationTarget): Promise<void> =>
  notify(
    order,
    "Payment failed",
    `The payment for booking ${order.order_number} did not go through. You can retry from your bookings.`,
    "payment"
  );

export const notifyBookingCancelled = (
  order: OrderNotificationTarget,
  refundOutcome: RefundOutcome
): Promise<void> => {
  const tail =
    refundOutcome === "success"
      ? " Your refund has been initiated and should reflect in 5-7 working days."
      : refundOutcome === "failed"
        ? " We could not process the refund automatically — our team will follow up with you."
        : "";
  return notify(
    order,
    "Booking cancelled",
    `Booking ${order.order_number} has been cancelled.${tail}`,
    "booking_update"
  );
};

export const notifyRefundCompleted = (order: OrderNotificationTarget): Promise<void> =>
  notify(
    order,
    "Refund completed",
    `The refund for booking ${order.order_number} has been completed.`,
    "payment"
  );

export const notifyPanditAssigned = (order: OrderNotificationTarget): Promise<void> =>
  notify(
    order,
    "Pandit assigned",
    `A pandit has been assigned to booking ${order.order_number} and will confirm shortly.`,
    "pandit_assigned"
  );

// Admin status transitions the customer should hear about. Statuses not in this
// map (e.g. 'disputed') deliberately produce no customer notification.
const ADMIN_STATUS_MESSAGES: Record<string, { title: string; body: (n: string) => string }> = {
  in_progress: {
    title: "Service started",
    body: (n) => `Your pandit has started the service for booking ${n}.`,
  },
  completed: {
    title: "Booking completed",
    body: (n) => `Booking ${n} has been marked as completed. We'd love your feedback!`,
  },
};

export const notifyOrderStatusChange = (
  order: OrderNotificationTarget,
  status: string
): Promise<void> => {
  const entry = ADMIN_STATUS_MESSAGES[status];
  if (!entry) return Promise.resolve();
  return notify(order, entry.title, entry.body(order.order_number), "booking_update");
};

export const notifyBookingReminder = (
  order: OrderNotificationTarget,
  window: "24h" | "2h",
  serviceTitle: string
): Promise<void> => {
  const when = window === "24h" ? "tomorrow" : "in about 2 hours";
  return notify(
    order,
    "Upcoming booking reminder",
    `Reminder: your "${serviceTitle}" booking (${order.order_number}) is scheduled ${when}.`,
    "booking_update"
  );
};
