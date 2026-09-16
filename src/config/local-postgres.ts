import fs from "fs";
import path from "path";
import { env } from "./env";
import { pool } from "./database";
import { logger } from "./logger";

const DATA_DIR = path.join(process.cwd(), ".local-pg");
const SCHEMA_MARKER = path.join(DATA_DIR, ".schema-applied");
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

const databaseUrl = (): URL => new URL(env.DATABASE_URL);

const isLocalDatabase = (): boolean => LOCAL_HOSTS.has(databaseUrl().hostname);

const ping = async (): Promise<boolean> => {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
};

const hasOtpTable = async (): Promise<boolean> => {
  const result = await pool.query<{ t: string | null }>(
    "SELECT to_regclass('public.otp_verifications') AS t"
  );
  return Boolean(result.rows[0]?.t);
};

const applySchemaIfNeeded = async (): Promise<void> => {
  if (await hasOtpTable()) {
    if (!fs.existsSync(SCHEMA_MARKER)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(SCHEMA_MARKER, new Date().toISOString());
    }
    return;
  }

  logger.info("Applying schema.sql and seed.sql to the local database");
  const schema = fs.readFileSync(path.join(process.cwd(), "src/database/schema.sql"), "utf8");
  const seed = fs.readFileSync(path.join(process.cwd(), "src/database/seed.sql"), "utf8");
  await pool.query(schema);
  await pool.query(seed);
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(SCHEMA_MARKER, new Date().toISOString());
  logger.info("Local database schema applied");
};

export const ensureDatabase = async (): Promise<void> => {
  if (await ping()) {
    if (isLocalDatabase()) await applySchemaIfNeeded();
    return;
  }

  if (env.NODE_ENV === "production" || !isLocalDatabase()) {
    throw new Error(
      "Unable to connect to the database. PostgreSQL is not running or DATABASE_URL is incorrect."
    );
  }

  logger.warn("Local PostgreSQL is not running — starting an embedded instance for development");

  const { default: EmbeddedPostgres } = await import("embedded-postgres");
  const url = databaseUrl();
  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: decodeURIComponent(url.username || "postgres"),
    password: decodeURIComponent(url.password || "postgres"),
    port: Number(url.port || 5432),
    persistent: true,
  });

  if (!fs.existsSync(path.join(DATA_DIR, "PG_VERSION"))) {
    await pg.initialise();
  }

  try {
    await pg.start();
  } catch (err) {
    if (!(await ping())) {
      logger.error("Failed to start embedded PostgreSQL", {
        message: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  try {
    await pg.createDatabase(url.pathname.replace(/^\//, "") || "yajman");
  } catch {
    // Database already exists from a previous run.
  }

  if (!(await ping())) {
    throw new Error(
      "Embedded PostgreSQL started but the app still cannot connect. Check DATABASE_URL (user/password/port)."
    );
  }

  await applySchemaIfNeeded();
};
