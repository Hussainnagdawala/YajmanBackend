/**
 * One-time migration: legacy MySQL `User` table (yamprod production dump) ->
 * new Postgres `users` table.
 *
 * SAFE BY DEFAULT — this script only reads the dump and writes report files
 * under scripts/migration-output/. It never touches the target database
 * unless you explicitly pass --commit, and even then it only INSERTs
 * (nothing is ever deleted or overwritten; duplicate phones are skipped via
 * ON CONFLICT DO NOTHING so re-running is always safe).
 *
 * Usage:
 *   node scripts/migrate-users.js                  # dry run (default) — writes reports only
 *   node scripts/migrate-users.js --sample=20       # also print 20 example transformed rows
 *   node scripts/migrate-users.js --commit          # actually insert into DATABASE_URL
 *   node scripts/migrate-users.js --dump=<path>     # override dump file path
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const crypto = require("crypto");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

// ─── CLI args ────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const COMMIT = args.includes("--commit");
const sampleArg = args.find((a) => a.startsWith("--sample="));
const SAMPLE_COUNT = sampleArg ? Number(sampleArg.slice("--sample=".length)) : 0;
const dumpArg = args.find((a) => a.startsWith("--dump="));
const DUMP_PATH = dumpArg
  ? path.resolve(dumpArg.slice("--dump=".length))
  : path.join(__dirname, "..", "dump-yamprod-202608061629.sql");

const OUT_DIR = path.join(__dirname, "migration-output");

// ─── Column orders — copied from the dump's own CREATE TABLE statements ──
// (User: line ~2340, UserRoles: line ~2549, RoleMst: line ~2038 in the dump
// this was built against — re-verify if you're pointing this at a newer dump)

const USER_COLUMNS = [
  "id", "fullName", "gender", "dob", "email", "phone", "password", "countryCode",
  "status", "isVerified", "otpSent", "otpSentAt", "deviceType", "platFormType",
  "email_verification_code", "deviceToken", "appVersion", "bio", "address",
  "rashifal", "profilePic", "referalCode", "referalUserId", "createdAt", "updatedAt",
];
const USER_ROLES_COLUMNS = ["id", "userId", "roleId", "templeId", "createdAt", "updatedAt"];
const ROLE_MST_COLUMNS = ["id", "name", "createdAt", "updatedAt"];

// Staff/back-office roles from the old RoleMst table. Users whose ONLY roles
// fall in this set are skipped, not migrated as customers — they need a
// deliberate admin account created in the new system, not an auto-import
// with unknown/stale permissions.
const STAFF_ROLE_NAMES = new Set([
  "superAdmin", "contentManager", "templeManager", "serviceManager",
  "callCenter", "marketing", "jyotishi", "packageManager", "artist",
]);

// ─── Generic MySQL-dump VALUES tuple parser ───────────────────────────────
// A naive split(',') breaks the moment a name/address contains a comma or an
// escaped quote (e.g. "O'Brien", "123, MG Road"). This is a small hand-rolled
// state machine instead: walks the VALUES(...),(...),... text character by
// character, tracking whether we're inside a quoted string, and understands
// MySQL's two escape forms — backslash-escapes (\', \\, \n) and doubled
// quotes ('').

function parseValuesList(valuesText) {
  const rows = [];
  let i = 0;
  const n = valuesText.length;

  while (i < n) {
    while (i < n && valuesText[i] !== "(") i++;
    if (i >= n) break;
    i++; // skip '('

    const row = [];
    let field = "";
    let inString = false;
    let quoted = false;

    while (i < n) {
      const ch = valuesText[i];

      if (inString) {
        if (ch === "\\") {
          // Backslash-escape: the next char is literal (\n -> n is NOT
          // converted to a newline here on purpose — we only care about
          // \' \\ \" showing up unescaped in the output text).
          field += valuesText[i + 1];
          i += 2;
          continue;
        }
        if (ch === "'") {
          if (valuesText[i + 1] === "'") {
            field += "'"; // doubled '' inside a string = one literal quote
            i += 2;
            continue;
          }
          inString = false;
          i++;
          continue;
        }
        field += ch;
        i++;
        continue;
      }

      if (ch === "'") {
        inString = true;
        quoted = true;
        i++;
        continue;
      }
      if (ch === ",") {
        row.push(finishField(field, quoted));
        field = "";
        quoted = false;
        i++;
        continue;
      }
      if (ch === ")") {
        row.push(finishField(field, quoted));
        rows.push(row);
        i++;
        break;
      }
      field += ch;
      i++;
    }
  }

  return rows;
}

function finishField(raw, wasQuoted) {
  if (wasQuoted) return raw;
  const trimmed = raw.trim();
  if (trimmed === "" || trimmed === "NULL") return null;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  return trimmed; // unexpected bareword (shouldn't happen in a clean dump)
}

function rowToObject(row, columns, tableName) {
  if (row.length !== columns.length) {
    throw new Error(
      `${tableName}: row has ${row.length} fields, expected ${columns.length} — dump format may have changed`
    );
  }
  const obj = {};
  columns.forEach((col, idx) => (obj[col] = row[idx]));
  return obj;
}

// ─── Streaming extraction — read the 86MB dump line-by-line, only keep the
// tables we actually need in memory (User ~15.7k rows, UserRoles ~16.3k
// rows, RoleMst 11 rows — all small once parsed; it's the raw dump text
// around them that's huge, so we never hold the whole file at once) ──────

async function extractTable(columns, tableName) {
  const marker = `INSERT INTO \`${tableName}\` VALUES `;
  const rows = [];
  const rl = readline.createInterface({
    input: fs.createReadStream(DUMP_PATH, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (line.startsWith(marker)) {
      const valuesText = line.slice(marker.length);
      for (const tuple of parseValuesList(valuesText)) {
        rows.push(rowToObject(tuple, columns, tableName));
      }
    }
  }
  return rows;
}

// ─── Field-level normalizers (each edge case gets its own small function,
// explained in the plain-language summary printed at the end) ────────────

function normalizePhone(raw) {
  if (!raw) return { phone: null, reason: "missing_phone" };
  let digits = String(raw).replace(/\D/g, "");
  if (digits.length > 10) digits = digits.slice(-10); // strip leading 91/0/spaces-as-digits etc
  if (digits.length !== 10) return { phone: null, reason: "invalid_phone_format" };
  return { phone: digits, reason: null };
}

function normalizeCountryCode(raw) {
  if (!raw) return "+91";
  let cc = String(raw).trim();
  if (!cc) return "+91";
  if (!cc.startsWith("+")) cc = "+" + cc.replace(/\D/g, "");
  return cc.length > 1 ? cc : "+91";
}

const GENDER_MAP = { male: "male", m: "male", female: "female", f: "female", other: "other", others: "other" };
function normalizeGender(raw) {
  if (!raw) return null;
  const key = String(raw).trim().toLowerCase();
  return GENDER_MAP[key] || null; // unrecognized value -> null, not a hard failure
}

function normalizeEmail(raw) {
  if (!raw) return null;
  const trimmed = String(raw).trim().toLowerCase();
  if (!trimmed) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null; // garbage/placeholder email -> null, non-fatal
  return trimmed.slice(0, 150); // matches VARCHAR(150) column limit
}

function normalizeDob(raw) {
  if (!raw) return null;
  const d = new Date(String(raw).replace(" ", "T") + "Z");
  if (isNaN(d.getTime())) return null;
  const year = d.getUTCFullYear();
  const currentYear = new Date().getFullYear();
  if (year < 1900 || year > currentYear) return null; // MySQL zero-dates / bogus years
  return d.toISOString().slice(0, 10);
}

function normalizeStatus(raw) {
  const n = Number(raw);
  if (n === 1) return { status: "active", unmapped: false };
  if (n === 0) return { status: "inactive", unmapped: false };
  // Any other int value we haven't seen documented — default to active but
  // flag it so a human can double check what that status code meant.
  return { status: "active", unmapped: true };
}

// Old datetimes are naive (no timezone stored). The app and its users are
// India-based, so we assume they were captured in IST and convert to a real
// UTC instant for the new TIMESTAMPTZ columns.
function istNaiveToUtcIso(raw) {
  if (!raw) return null;
  const d = new Date(String(raw).replace(" ", "T") + "+05:30");
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

// ─── Role classification ──────────────────────────────────────────────────

function classifyRole(userId, rolesByUserId, roleNameById) {
  const roleIds = rolesByUserId.get(userId) || [];
  const roleNames = roleIds.map((rid) => roleNameById.get(rid)).filter(Boolean);
  if (roleNames.some((r) => STAFF_ROLE_NAMES.has(r))) {
    return { role: null, skipReason: "staff_role_skipped" };
  }
  if (roleNames.includes("pandit")) return { role: "pandit", skipReason: null };
  return { role: "customer", skipReason: null }; // no role row at all = implicit customer, matches old app + new schema default
}

// ─── Main ──────────────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(DUMP_PATH)) {
    console.error(`Dump file not found: ${DUMP_PATH}`);
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log(`Reading ${DUMP_PATH} ...`);
  const [users, userRoles, roleMst] = await Promise.all([
    extractTable(USER_COLUMNS, "User"),
    extractTable(USER_ROLES_COLUMNS, "UserRoles"),
    extractTable(ROLE_MST_COLUMNS, "RoleMst"),
  ]);
  console.log(`Parsed ${users.length} User rows, ${userRoles.length} UserRoles rows, ${roleMst.length} RoleMst rows.`);

  const roleNameById = new Map(roleMst.map((r) => [r.id, r.name]));
  const rolesByUserId = new Map();
  for (const ur of userRoles) {
    if (!rolesByUserId.has(ur.userId)) rolesByUserId.set(ur.userId, []);
    rolesByUserId.get(ur.userId).push(ur.roleId);
  }

  const skipped = {}; // reason -> [{ old_id, phone_raw, note }]
  const softNotes = {}; // reason -> count (non-fatal, informational only)
  const addSkip = (reason, entry) => {
    if (!skipped[reason]) skipped[reason] = [];
    if (skipped[reason].length < 50) skipped[reason].push(entry); // cap sample size, keep count separately
    skipped[`${reason}__count`] = (skipped[`${reason}__count`] || 0) + 1;
  };
  const addNote = (reason, sampleValue) => {
    if (!softNotes[reason]) softNotes[reason] = { count: 0, samples: [] };
    softNotes[reason].count++;
    if (sampleValue !== undefined && softNotes[reason].samples.length < 20 && !softNotes[reason].samples.includes(sampleValue)) {
      softNotes[reason].samples.push(sampleValue);
    }
  };

  const candidates = []; // successfully transformed, pre-dedup

  for (const u of users) {
    const { role, skipReason } = classifyRole(u.id, rolesByUserId, roleNameById);
    if (skipReason) {
      addSkip(skipReason, { old_id: u.id, phone_raw: u.phone, email: u.email });
      continue;
    }

    const { phone, reason: phoneReason } = normalizePhone(u.phone);
    if (!phone) {
      addSkip(phoneReason, { old_id: u.id, phone_raw: u.phone, email: u.email });
      continue;
    }

    const statusResult = normalizeStatus(u.status);
    if (statusResult.unmapped) addNote("status_unmapped_defaulted_active", u.status);

    const email = normalizeEmail(u.email);
    if (u.email && !email) addNote("email_dropped_invalid_format", u.email);

    const dob = normalizeDob(u.dob);
    if (u.dob && !dob) addNote("dob_dropped_invalid", u.dob);

    const avatarUrl = u.profilePic ? String(u.profilePic).trim() || null : null;
    if (avatarUrl) addNote("avatar_url_unverified", avatarUrl); // can't check reachability offline

    const createdAt = istNaiveToUtcIso(u.createdAt) || new Date().toISOString();
    if (!u.createdAt) addNote("created_at_defaulted_now");
    const updatedAt = istNaiveToUtcIso(u.updatedAt) || createdAt;

    candidates.push({
      old_id: u.id,
      new_id: crypto.randomUUID(),
      phone,
      country_code: normalizeCountryCode(u.countryCode),
      name: u.fullName ? String(u.fullName).trim().slice(0, 100) || null : null,
      email,
      avatar_url: avatarUrl,
      role,
      status: statusResult.status,
      gender: normalizeGender(u.gender),
      date_of_birth: dob,
      created_at: createdAt,
      updated_at: updatedAt,
    });
  }

  // Dedup by normalized phone — new schema requires it unique, old one
  // didn't enforce that at all. Keep whichever row was updated most
  // recently; everyone else with the same phone is logged, not silently
  // dropped.
  const byPhone = new Map();
  for (const c of candidates) {
    const existing = byPhone.get(c.phone);
    if (!existing) {
      byPhone.set(c.phone, c);
      continue;
    }
    const winner = new Date(c.updated_at) > new Date(existing.updated_at) ? c : existing;
    const loser = winner === c ? existing : c;
    addSkip("duplicate_phone", {
      old_id: loser.old_id,
      phone_raw: loser.phone,
      note: `superseded by old_id ${winner.old_id} (more recently updated)`,
    });
    byPhone.set(c.phone, winner);
  }

  const finalUsers = [...byPhone.values()];

  // ─── Write reports ───────────────────────────────────────────────────

  const idMapping = finalUsers.map((u) => ({ old_id: u.old_id, new_id: u.new_id, phone: u.phone }));
  fs.writeFileSync(path.join(OUT_DIR, "id-mapping.json"), JSON.stringify(idMapping, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, "users-to-insert.json"), JSON.stringify(finalUsers, null, 2));

  const skippedSummary = {};
  for (const key of Object.keys(skipped)) {
    if (key.endsWith("__count")) continue;
    skippedSummary[key] = { count: skipped[`${key}__count`] || skipped[key].length, sample: skipped[key] };
  }
  fs.writeFileSync(path.join(OUT_DIR, "skipped.json"), JSON.stringify(skippedSummary, null, 2));

  const summary = {
    dump_file: DUMP_PATH,
    total_parsed: users.length,
    migrated: finalUsers.length,
    skipped_by_reason: Object.fromEntries(Object.keys(skippedSummary).map((k) => [k, skippedSummary[k].count])),
    non_fatal_notes: softNotes,
  };
  fs.writeFileSync(path.join(OUT_DIR, "summary.json"), JSON.stringify(summary, null, 2));

  console.log("\n=== Migration dry-run summary ===");
  console.log(JSON.stringify(summary, null, 2));
  console.log(`\nFull output written to ${OUT_DIR}/`);

  if (SAMPLE_COUNT > 0) {
    console.log(`\n=== ${SAMPLE_COUNT} sample transformed rows ===`);
    console.log(JSON.stringify(finalUsers.slice(0, SAMPLE_COUNT), null, 2));
  }

  if (!COMMIT) {
    console.log("\nDry run only — nothing written to the database. Re-run with --commit to insert.");
    return;
  }

  // ─── Commit path — only runs with --commit ────────────────────────────

  const { Client } = require("pg");
  // Match src/config/database.ts — DigitalOcean managed Postgres presents a
  // chain Node's default CA store rejects as "self-signed certificate in
  // certificate chain" when sslmode=require is treated as verify-full.
  const databaseUrl = new URL(process.env.DATABASE_URL);
  const sslMode = databaseUrl.searchParams.get("sslmode")?.toLowerCase();
  databaseUrl.search = ""; // configure SSL explicitly (same as src/config/database.ts)
  const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  let useSsl = !localHosts.has(databaseUrl.hostname);
  if (sslMode === "disable" || sslMode === "false") useSsl = false;
  else if (sslMode === "require" || sslMode === "verify-full" || sslMode === "verify-ca") useSsl = true;

  const client = new Client({
    connectionString: databaseUrl.toString(),
    ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  });
  await client.connect();

  const BATCH_SIZE = 500;
  let inserted = 0;
  let conflicted = 0;

  try {
    for (let i = 0; i < finalUsers.length; i += BATCH_SIZE) {
      const batch = finalUsers.slice(i, i + BATCH_SIZE);
      await client.query("BEGIN");
      for (const u of batch) {
        const result = await client.query(
          `INSERT INTO users (id, phone, country_code, name, email, avatar_url, role, status, gender, date_of_birth, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           ON CONFLICT (phone) DO NOTHING
           RETURNING id`,
          [u.new_id, u.phone, u.country_code, u.name, u.email, u.avatar_url, u.role, u.status, u.gender, u.date_of_birth, u.created_at, u.updated_at]
        );
        if (result.rows.length > 0) inserted++;
        else conflicted++;
      }
      await client.query("COMMIT");
      console.log(`Inserted batch ${i / BATCH_SIZE + 1} (${Math.min(i + BATCH_SIZE, finalUsers.length)}/${finalUsers.length})`);
    }
    console.log(`\nDone. Inserted ${inserted} new users, ${conflicted} already existed (skipped via phone conflict).`);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Migration failed mid-run:", err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
