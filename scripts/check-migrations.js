/**
 * List applied vs pending migrations for the current DATABASE_URL (.env).
 *
 * Usage: node scripts/check-migrations.js
 */
const path = require("path");
const { Client } = require("pg");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

const MIGRATIONS = [
  {
    file: "001_add_device_tokens.sql",
    checkSql:
      "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='device_tokens')",
  },
  {
    file: "002_notification_campaigns.sql",
    checkSql:
      "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='notification_campaigns')",
  },
  {
    file: "003_app_settings_management.sql",
    checkSql:
      "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='app_settings' AND column_name='is_public')",
  },
  {
    file: "004_app_settings_catalog_expand.sql",
    checkSql: "SELECT EXISTS (SELECT 1 FROM app_settings WHERE key = 'general.privacy_policy_url')",
  },
  {
    file: "005_addons.sql",
    checkSql:
      "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='addons')",
  },
  {
    file: "006_service_benefits.sql",
    checkSql:
      "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='services' AND column_name='benefits')",
  },
  {
    file: "007_service_key_features_flat.sql",
    checkSql:
      "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='services' AND column_name='key_features')",
  },
  {
    file: "008_service_availability_and_free_addons.sql",
    checkSql:
      "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='services' AND column_name='booking_availability_type')",
  },
  {
    file: "009_category_capability_flags.sql",
    checkSql:
      "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='categories' AND column_name='requires_pandit')",
  },
  {
    file: "010_order_payment_failure_states.sql",
    checkSql:
      "SELECT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'booking_status' AND e.enumlabel = 'payment_failed')",
  },
  {
    file: "011_contact_inquiry_category.sql",
    checkSql:
      "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='contact_form_entries' AND column_name='category_id')",
  },
  {
    file: "012_aayojan_gallery_images.sql",
    checkSql:
      "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='aayojan_gallery_images')",
  },
  {
    file: "013_analytics_events.sql",
    checkSql:
      "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='analytics_events')",
  },
  {
    file: "014_gallery_images.sql",
    checkSql:
      "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='gallery_images')",
  },
  {
    file: "015_category_requires_booking_time.sql",
    checkSql:
      "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='categories' AND column_name='requires_booking_time')",
  },
  {
    file: "016_puja_processes.sql",
    checkSql:
      "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='puja_processes')",
  },
  {
    file: "017_services_display_order_unique.sql",
    checkSql:
      "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_services_display_order_unique')",
  },
  {
    file: "018_service_placements_enhance.sql",
    checkSql:
      "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='recommended_services' AND column_name='starts_at')",
  },
  {
    file: "019_categories_display_order_unique.sql",
    checkSql:
      "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_categories_display_order_unique')",
  },
  {
    file: "020_legal_pages.sql",
    checkSql:
      "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='legal_pages')",
  },
];

const buildClientConfig = () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set in .env");
  const url = new URL(connectionString);
  const sslMode = url.searchParams.get("sslmode")?.toLowerCase();
  const useSsl =
    sslMode === "require" || sslMode === "verify-full" || sslMode === "verify-ca"
      ? true
      : sslMode === "disable" || sslMode === "false"
        ? false
        : !LOCAL_HOSTS.has(url.hostname);
  return { connectionString, ssl: useSsl ? { rejectUnauthorized: false } : false };
};

(async () => {
  const client = new Client(buildClientConfig());
  await client.connect();

  const applied = [];
  const pending = [];

  for (const migration of MIGRATIONS) {
    const { rows } = await client.query(migration.checkSql);
    const isApplied = rows[0]?.exists === true;
    if (isApplied) applied.push(migration.file);
    else pending.push(migration.file);
  }

  await client.end();

  console.log("\n=== Migration status (local DATABASE_URL) ===\n");
  console.log(`Applied (${applied.length}):`);
  for (const file of applied) console.log(`  ✓ ${file}`);
  console.log(`\nPending (${pending.length}):`);
  if (pending.length === 0) {
    console.log("  (none — database is up to date)");
  } else {
    for (const file of pending) console.log(`  ✗ ${file}`);
    console.log(`\nRun next: node scripts/run-migration.js ${pending[0]}`);
  }
  console.log("");
})().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
