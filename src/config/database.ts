import { Pool, PoolConfig, types } from "pg";
import { env } from "./env";
import { logger } from "./logger";

const DATE_OID = 1082;
types.setTypeParser(DATE_OID, (value: string) => value);

const databaseUrl = new URL(env.DATABASE_URL);
const sslMode = databaseUrl.searchParams.get("sslmode")?.toLowerCase();

// pg reads sslmode from the URL — we configure SSL explicitly below instead.
databaseUrl.search = "";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

const shouldUseSsl = (): boolean => {
  if (sslMode === "disable" || sslMode === "false") return false;
  if (sslMode === "require" || sslMode === "verify-full" || sslMode === "verify-ca") return true;
  // Remote managed databases (e.g. DigitalOcean) need SSL; local Postgres does not.
  return !LOCAL_HOSTS.has(databaseUrl.hostname);
};

const poolConfig: PoolConfig = {
  connectionString: databaseUrl.toString(),
  min: env.DB_POOL_MIN,
  max: env.DB_POOL_MAX,
};

if (shouldUseSsl()) {
  poolConfig.ssl = { rejectUnauthorized: false };
}

export const pool = new Pool(poolConfig);

pool.on("error", (err) => {
  logger.error("Unexpected error on idle database client", { message: err.message, stack: err.stack });
});

pool.on("connect", () => {
  logger.debug("New database connection established");
});

if (env.NODE_ENV !== "production") {
  logger.debug(`Database pool configured for ${databaseUrl.hostname} (ssl=${shouldUseSsl()})`);
}
