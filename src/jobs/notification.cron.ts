import cron from "node-cron";
import { logger } from "../config/logger";
import { processDueScheduledCampaigns } from "../services/notification.service";

let started = false;

export const startNotificationCron = (): void => {
  if (started) return;
  started = true;

  // Every minute: send due scheduled campaigns
  cron.schedule("* * * * *", async () => {
    try {
      const processed = await processDueScheduledCampaigns();
      if (processed > 0) {
        logger.info("Processed scheduled notification campaigns", { processed });
      }
    } catch (err) {
      logger.error("Notification cron failed", { err });
    }
  });

  logger.info("Notification scheduler started (every minute)");
};
