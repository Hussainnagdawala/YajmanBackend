#!/usr/bin/env node
const { spawnSync } = require("child_process");
const path = require("path");
require("dotenv").config();

const repoRoot = path.resolve(__dirname, "..");
const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error(
    "DATABASE_URL is required. Set it in your environment or .env file.",
  );
  process.exit(1);
}

const psqlBin = process.platform === "win32" ? "psql.exe" : "psql";
const schemaSql = path.join(repoRoot, "src", "database", "schema.sql");
const seedSql = path.join(repoRoot, "src", "database", "seed.sql");
const migrationsDir = path.join(repoRoot, "src", "database", "migrations");

const migrations = [
  {
    file: "001_add_device_tokens.sql",
    checkSql:
      "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='device_tokens');",
  },
  {
    file: "002_notification_campaigns.sql",
    checkSql:
      "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='notification_campaigns');",
  },
  {
    file: "003_app_settings_management.sql",
    checkSql:
      "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='app_settings' AND column_name='is_public');",
  },
  {
    file: "004_app_settings_catalog_expand.sql",
    checkSql:
      "SELECT EXISTS (SELECT 1 FROM app_settings WHERE key = 'general.privacy_policy_url');",
  },
];

function runPsql(filePath, description) {
  const result = spawnSync(
    psqlBin,
    [dbUrl, "-v", "ON_ERROR_STOP=1", "-f", filePath],
    {
      cwd: repoRoot,
      env: process.env,
      stdio: "inherit",
    },
  );

  if (result.status !== 0) {
    throw new Error(
      `Failed to ${description} from ${path.relative(repoRoot, filePath)}.`,
    );
  }
}

function querySql(sql, description) {
  const result = spawnSync(psqlBin, [dbUrl, "-tA", "-c", sql], {
    cwd: repoRoot,
    env: process.env,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(`Failed to ${description}.`);
  }

  return result.stdout.trim();
}

try {
  const schemaExists =
    querySql(
      "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='users');",
      "check schema readiness",
    ) === "t";

  if (!schemaExists) {
    console.log("Applying schema...");
    runPsql(schemaSql, "apply schema");
  } else {
    console.log("Schema already exists, skipping schema.sql.");
  }

  const seedExists =
    querySql(
      "SELECT EXISTS (SELECT 1 FROM users WHERE phone = '8109181057');",
      "check seeded admin user",
    ) === "t";

  if (!seedExists) {
    console.log("Applying seed data...");
    runPsql(seedSql, "apply seed data");
  } else {
    console.log("Seed data already present, skipping seed.sql.");
  }

  for (const migration of migrations) {
    const applied = querySql(migration.checkSql, `check ${migration.file}`) === "t";
    if (!applied) {
      console.log(`Applying ${migration.file}...`);
      runPsql(path.join(migrationsDir, migration.file), `apply ${migration.file}`);
    } else {
      console.log(`Migration already applied, skipping ${migration.file}.`);
    }
  }

  console.log("Database seed process completed.");
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
