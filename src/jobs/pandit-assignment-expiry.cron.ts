import cron from "node-cron";
import { pool } from "../config/database";
import { logger } from "../config/logger";
import { expireStaleAssignments } from "../queries/pandit.queries";
import { listAdminUserIds } from "../queries/user.queries";
import { createNotification } from "../services/notification.service";

let started = false;

export const startPanditAssignmentExpiryCron = (): void => {
  if (started) return;
  started = true;

  // Every 15 minutes: a pending assignment whose 48h respond_by has passed
  // used to just sit there forever — nobody was ever told, and 'expired' (an
  // existing enum value) was never actually set anywhere. This is the fix.
  cron.schedule("*/15 * * * *", async () => {
    try {
      const expired = await pool.query<{ id: string; order_id: string; pandit_id: string; order_number: string }>(
        expireStaleAssignments
      );
      if (expired.rows.length === 0) return;

      const admins = await pool.query<{ id: string }>(listAdminUserIds);
      for (const row of expired.rows) {
        for (const admin of admins.rows) {
          await createNotification(
            admin.id,
            "Pandit assignment expired — needs reassignment",
            `No response within 48 hours for order ${row.order_number}. Please reassign a pandit.`,
            "pandit_assigned",
            "order",
            row.order_id
          );
        }
      }
      logger.info("Expired stale pandit assignments", { count: expired.rows.length });
    } catch (err) {
      logger.error("Pandit assignment expiry cron failed", { err });
    }
  });

  logger.info("Pandit assignment expiry scheduler started (every 15 minutes)");
};
