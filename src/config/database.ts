import { Pool, types } from "pg";
import { env } from "./env";
import { logger } from "./logger";

const DATE_OID = 1082;
types.setTypeParser(DATE_OID, (value: string) => value);

const databaseUrl = new URL(env.DATABASE_URL);

// Remove sslmode from the URL.
// SSL is configured explicitly below.
databaseUrl.search = "";

export const pool = new Pool({
  connectionString: databaseUrl.toString(),
  min: env.DB_POOL_MIN,
  max: env.DB_POOL_MAX,
  ssl: {
    rejectUnauthorized: false,
  },
});

pool.on("error", (err) => {
  logger.error("Unexpected error on idle database client", err);
});

pool.on("connect", () => {
  logger.debug("New database connection established");
});
