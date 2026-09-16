import { app } from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { initFirebase } from "./config/firebase";
import { ensureDatabase } from "./config/local-postgres";
import { startNotificationCron } from "./jobs/notification.cron";
import { startOrderExpiryCron } from "./jobs/order-expiry.cron";
import { startPanditAssignmentExpiryCron } from "./jobs/pandit-assignment-expiry.cron";
import { startBookingReminderCron } from "./jobs/booking-reminder.cron";
import { startBookingFollowupCron } from "./jobs/booking-followup.cron";

const start = async (): Promise<void> => {
  initFirebase();
  await ensureDatabase();

  startNotificationCron();
  startOrderExpiryCron();
  startPanditAssignmentExpiryCron();
  startBookingReminderCron();
  startBookingFollowupCron();

  app.listen(env.PORT, () => {
    logger.info(`Server running on port ${env.PORT} [${env.NODE_ENV}]`);
  });
};

start().catch((err) => {
  logger.error("Failed to start server", {
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  process.exit(1);
});
