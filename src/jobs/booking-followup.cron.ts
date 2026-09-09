import cron from "node-cron";
import { pool } from "../config/database";
import { logger } from "../config/logger";
import { listAdminUserIds } from "../queries/user.queries";
import {
  findAssignmentsNearingExpiry,
  markAssignmentExpiryNudgeSent,
} from "../queries/pandit.queries";
import {
  findUnassignedBookingsNearingDate,
  markUnassignedAlertSent,
  findOverdueUnresolvedBookings,
  markOverdueAlertSent,
} from "../queries/order.queries";
import { createNotification } from "../services/notification.service";

let started = false;

const notifyAllAdmins = async (title: string, body: string, referenceId: string): Promise<void> => {
  const admins = await pool.query<{ id: string }>(listAdminUserIds);
  for (const admin of admins.rows) {
    await createNotification(admin.id, title, body, "booking_update", "order", referenceId);
  }
};

// Three follow-up signals nothing else in the system generated:
//  1. Pending assignment nearing its 48h window — nudge the pandit before it
//     silently expires (pandit-assignment-expiry.cron.ts only notifies admin
//     AFTER expiry — this fires first, while the pandit can still act).
//  2. Confirmed order approaching its booking date with no pandit ever
//     assigned — admin heads-up while there's still time to find someone.
//  3. Booking date passed with the order still unresolved (never completed,
//     never cancelled) — order used to just sit there invisibly forever
//     (see the STATUS_GROUPS comment in booking.queries.ts); this is the
//     safety net.
// Each check has its own *_sent_at flag so it fires exactly once, same
// pattern as reminder_24h_sent_at / reminder_2h_sent_at.
// Three independent schedules, not one — a failure in any single check
// (e.g. a bad row) logs and stops just that check for this tick instead of
// blocking the other two.
export const startBookingFollowupCron = (): void => {
  if (started) return;
  started = true;

  cron.schedule("*/15 * * * *", async () => {
    try {
      await nudgePanditsNearingExpiry();
    } catch (err) {
      logger.error("Pandit expiry-nudge check failed", { err });
    }
  });

  cron.schedule("*/15 * * * *", async () => {
    try {
      await alertAdminsUnassignedNearingDate();
    } catch (err) {
      logger.error("Unassigned-booking alert check failed", { err });
    }
  });

  cron.schedule("*/15 * * * *", async () => {
    try {
      await alertAdminsOverdueUnresolved();
    } catch (err) {
      logger.error("Overdue-booking alert check failed", { err });
    }
  });

  logger.info("Booking follow-up scheduler started (every 15 minutes)");
};

const nudgePanditsNearingExpiry = async (): Promise<void> => {
  const { rows } = await pool.query<{
    id: string;
    order_id: string;
    pandit_user_id: string;
    order_number: string;
  }>(findAssignmentsNearingExpiry);
  if (rows.length === 0) return;

  for (const row of rows) {
    await createNotification(
      row.pandit_user_id,
      "Respond soon — assignment expiring",
      `Your assignment for order ${row.order_number} expires within 12 hours. Accept or reject it before then.`,
      "pandit_assigned",
      "order",
      row.order_id
    );
    await pool.query(markAssignmentExpiryNudgeSent, [row.id]);
  }
  logger.info("Nudged pandits with assignments nearing expiry", { count: rows.length });
};

const alertAdminsUnassignedNearingDate = async (): Promise<void> => {
  const { rows } = await pool.query<{ id: string; order_number: string; booking_datetime: string }>(
    findUnassignedBookingsNearingDate
  );
  if (rows.length === 0) return;

  for (const row of rows) {
    await notifyAllAdmins(
      "Booking within 24h — no pandit assigned",
      `Order ${row.order_number} is scheduled within 24 hours and still has no pandit assigned.`,
      row.id
    );
    await pool.query(markUnassignedAlertSent, [row.id]);
  }
  logger.info("Alerted admins about unassigned bookings nearing their date", { count: rows.length });
};

const alertAdminsOverdueUnresolved = async (): Promise<void> => {
  const { rows } = await pool.query<{ id: string; order_number: string; status: string }>(
    findOverdueUnresolvedBookings
  );
  if (rows.length === 0) return;

  for (const row of rows) {
    await notifyAllAdmins(
      "Booking date passed — still not resolved",
      `Order ${row.order_number}'s booking date has passed but it's still '${row.status}' — mark it completed, or cancel/reassign as needed.`,
      row.id
    );
    await pool.query(markOverdueAlertSent, [row.id]);
  }
  logger.info("Alerted admins about overdue unresolved bookings", { count: rows.length });
};
