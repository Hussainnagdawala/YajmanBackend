import cron from "node-cron";
import { pool } from "../config/database";
import { logger } from "../config/logger";
import { expireStalePendingOrders, markStalePaymentsFailed } from "../queries/order.queries";

let started = false;

export const startOrderExpiryCron = (): void => {
  if (started) return;
  started = true;

  // Every 5 minutes: expire checkout attempts nobody ever completed payment
  // for, so they stop permanently blocking rebooking (findDuplicateBooking)
  // and stop sitting in the admin queue as if still in progress.
  cron.schedule("*/5 * * * *", async () => {
    try {
      const expired = await pool.query<{ id: string }>(expireStalePendingOrders);
      if (expired.rows.length > 0) {
        const orderIds = expired.rows.map((r) => r.id);
        await pool.query(markStalePaymentsFailed, [orderIds]);
        logger.info("Expired stale pending orders", { count: orderIds.length });
      }
    } catch (err) {
      logger.error("Order expiry cron failed", { err });
    }
  });

  logger.info("Order expiry scheduler started (every 5 minutes)");
};
