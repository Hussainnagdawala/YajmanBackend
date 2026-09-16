/**
 * Run a SQL migration file against DATABASE_URL from .env
 *
 * Usage:
 *   node scripts/run-migration.js 002_notification_campaigns.sql
 *   node scripts/run-migration.js src/database/migrations/015_category_requires_booking_time.sql
 */
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

const resolveMigrationPath = (arg) => {
  const candidates = [
    path.isAbsolute(arg) ? arg : path.join(process.cwd(), arg),
    path.join(__dirname, "..", "src", "database", "migrations", arg),
    path.join(__dirname, "..", arg),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(`Migration file not found: ${arg}`);
};

const buildClientConfig = () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set in .env");
  }
  const url = new URL(connectionString);
  const sslMode = url.searchParams.get("sslmode")?.toLowerCase();
  const useSsl =
    sslMode === "require" || sslMode === "verify-full" || sslMode === "verify-ca"
      ? true
      : sslMode === "disable" || sslMode === "false"
        ? false
        : !LOCAL_HOSTS.has(url.hostname);

  return {
    connectionString,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
  };
};

(async () => {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Usage: node scripts/run-migration.js <migration-file.sql>");
    process.exit(1);
  }

  const migrationPath = resolveMigrationPath(arg);
  const sql = fs.readFileSync(migrationPath, "utf8");
  const client = new Client(buildClientConfig());

  try {
    await client.connect();
    console.log(`Running migration: ${path.basename(migrationPath)}`);
    await client.query(sql);
    console.log("Migration applied successfully.");
  } catch (err) {
    console.error("Migration failed:", err.message || err);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
})();
