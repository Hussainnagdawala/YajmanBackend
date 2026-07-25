import { app } from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { pool } from "./config/database";
import { initFirebase } from "./config/firebase";
import { startNotificationCron } from "./jobs/notification.cron";

initFirebase();
startNotificationCron();

const server = app.listen(env.PORT, () => {
  logger.info(`Server running on port ${env.PORT} [${env.NODE_ENV}]`);
});

const shutdown = async (signal: string) => {
  logger.info(`${signal} received, shutting down`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
};

// process.on("SIGTERM", () => shutdown("SIGTERM"));
// process.on("SIGINT", () => shutdown("SIGINT"));
