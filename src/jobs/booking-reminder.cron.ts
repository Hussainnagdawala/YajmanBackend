import cron from "node-cron";
import { pool } from "../config/database";
import { logger } from "../config/logger";
import { findOrdersNeedingReminder, markReminderSent } from "../queries/booking.queries";
import { notifyBookingReminder } from "../services/order-notification.service";

let started = false;

interface ReminderRow {
  id: string;
  user_id: string;
  order_number: string;
  booking_datetime: string;
  reminder_24h_sent_at: string | null;
  reminder_2h_sent_at: string | null;
  service_title: string;
}

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

export const startBookingReminderCron = (): void => {
  if (started) return;
  started = true;

  // Every 15 minutes: send the T-24h and T-2h reminders for upcoming bookings,
  // each window exactly once (guarded by reminder_*_sent_at). If a booking is
  // already inside the 2h window the first time it's seen, the 24h flag is set
  // without firing so the customer never gets a stale "tomorrow" message.
  cron.schedule("*/15 * * * *", async () => {
    try {
      const { rows } = await pool.query<ReminderRow>(findOrdersNeedingReminder);
      if (rows.length === 0) return;

      const now = Date.now();
      let sent = 0;

      for (const row of rows) {
        const withinTwoHours = new Date(row.booking_datetime).getTime() - now <= TWO_HOURS_MS;

        if (withinTwoHours) {
          if (!row.reminder_2h_sent_at) {
            await notifyBookingReminder(row, "2h", row.service_title);
            sent += 1;
          }
          await pool.query(markReminderSent("reminder_2h_sent_at"), [row.id]);
          if (!row.reminder_24h_sent_at) {
            await pool.query(markReminderSent("reminder_24h_sent_at"), [row.id]);
          }
        } else if (!row.reminder_24h_sent_at) {
          await notifyBookingReminder(row, "24h", row.service_title);
          await pool.query(markReminderSent("reminder_24h_sent_at"), [row.id]);
          sent += 1;
        }
      }

      if (sent > 0) logger.info("Sent booking reminders", { count: sent });
    } catch (err) {
      logger.error("Booking reminder cron failed", { err });
    }
  });

  logger.info("Booking reminder scheduler started (every 15 minutes)");
};
