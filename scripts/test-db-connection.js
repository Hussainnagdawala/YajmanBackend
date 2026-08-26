/**
 * Test PostgreSQL connectivity (local + production).
 *
 * Usage:
 *   node scripts/test-db-connection.js
 *   DATABASE_URL="postgresql://..." node scripts/test-db-connection.js
 *
 * Reads DATABASE_URL from .env (local) and .env-prod (production) when set.
 * Does not print passwords.
 */
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const ROOT = path.join(__dirname, "..");

const readDatabaseUrl = (filename) => {
  const filePath = path.join(ROOT, filename);
  if (!fs.existsSync(filePath)) return null;
  const match = fs.readFileSync(filePath, "utf8").match(/^DATABASE_URL=(.+)$/m);
  if (!match) return null;
  const raw = match[1].trim();
  // .env-prod may accidentally concatenate two URLs — pick the DigitalOcean one.
  const doMatch = raw.match(/postgresql:\/\/[^@]+@[^/]*\.db\.ondigitalocean\.com:\d+\/\w+/);
  if (doMatch) return doMatch[0];
  if (raw.startsWith("postgresql://")) return raw.split("postgresql://")[1]?.includes("@")
    ? `postgresql://${raw.replace(/^postgresql:\/\//, "").split("postgresql://").pop()}`
    : raw;
  return raw.startsWith("postgres") ? raw : null;
};

const parseUrl = (connectionString) => {
  const url = new URL(connectionString);
  return {
    host: url.hostname,
    port: Number(url.port) || 5432,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, "") || "postgres",
    sslMode: url.searchParams.get("sslmode")?.toLowerCase(),
  };
};

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

const shouldUseSsl = (host, sslMode) => {
  if (sslMode === "disable" || sslMode === "false") return false;
  if (sslMode === "require" || sslMode === "verify-full" || sslMode === "verify-ca") return true;
  return !LOCAL_HOSTS.has(host);
};

async function tryConnect(label, config) {
  const client = new Client(config);
  try {
    await client.connect();
    const { rows } = await client.query("SELECT current_database() AS db, version() AS version");
    await client.end();
    return { ok: true, db: rows[0]?.db, version: rows[0]?.version?.split(" ")[0] + " " + rows[0]?.version?.split(" ")[1] };
  } catch (err) {
    try {
      await client.end();
    } catch (_) {}
    return { ok: false, error: err.message || String(err) };
  }
}

async function testUrl(label, connectionString, forceSsl) {
  let parsed;
  try {
    parsed = parseUrl(connectionString);
  } catch (err) {
    return {
      test: label,
      host: "(invalid URL)",
      port: "-",
      ssl: "-",
      result: "FAIL",
      error: err.message,
    };
  }

  const useSsl = forceSsl === undefined
    ? shouldUseSsl(parsed.host, parsed.sslMode)
    : forceSsl;

  const config = {
    host: parsed.host,
    port: parsed.port,
    user: parsed.user,
    database: parsed.database,
    password: parsed.password || undefined,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 15000,
  };

  const result = await tryConnect(label, config);
  return {
    test: label,
    host: parsed.host,
    port: parsed.port,
    ssl: useSsl ? "enabled (rejectUnauthorized: false)" : "disabled",
    result: result.ok ? "SUCCESS" : "FAIL",
    error: result.ok ? "" : result.error,
    note: result.ok ? `db=${result.db}, ${result.version}` : "",
  };
}

(async () => {
  const localUrl =
    process.env.LOCAL_DATABASE_URL ||
    readDatabaseUrl(".env") ||
    "postgresql://postgres@localhost:5432/yajman";

  const prodUrl =
    process.env.PROD_DATABASE_URL ||
    process.env.DATABASE_URL ||
    readDatabaseUrl(".env-prod");

  const rows = [];

  rows.push(await testUrl("Local", localUrl));

  if (prodUrl) {
    rows.push(await testUrl("Production (auto SSL)", prodUrl));
    rows.push(await testUrl("Production (SSL forced)", prodUrl, true));
    rows.push(await testUrl("Production (no SSL)", prodUrl, false));
  } else {
    rows.push({
      test: "Production",
      host: "-",
      port: "-",
      ssl: "-",
      result: "SKIP",
      error: "No production DATABASE_URL found in .env-prod or env",
      note: "",
    });
  }

  console.log("\n=== PostgreSQL connection tests ===\n");
  console.log("| Test | Host | Port | SSL | Result | Error | Note |");
  console.log("| --- | --- | --- | --- | --- | --- | --- |");
  for (const r of rows) {
    const err = (r.error || "").replace(/\|/g, "\\|").replace(/\n/g, " ");
    const note = (r.note || "").replace(/\|/g, "\\|");
    console.log(`| ${r.test} | ${r.host} | ${r.port} | ${r.ssl} | ${r.result} | ${err} | ${note} |`);
  }
  console.log("");
})();
