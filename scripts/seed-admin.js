#!/usr/bin/env node
const { spawnSync } = require("child_process");
const path = require("path");
require("dotenv").config();

const repoRoot = path.resolve(__dirname, "..");
const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error("DATABASE_URL is required. Set it in your environment or .env file.");
  process.exit(1);
}

const psqlBin = process.platform === "win32" ? "psql.exe" : "psql";

function querySql(sql, description) {
  const result = spawnSync(psqlBin, [dbUrl, "-tA", "-c", sql], {
    cwd: repoRoot,
    env: process.env,
    encoding: "utf8",
  });

  if (result.status !== 0) {
  console.error("PostgreSQL error:", result.stderr);
  console.error("PostgreSQL output:", result.stdout);
  throw new Error(`Failed to ${description}.`);
}
  return result.stdout.trim();
}

try {
  // Check if admin user already exists
  const adminPhone = "8109181057";
  const seedExists = querySql(
    `SELECT EXISTS (SELECT 1 FROM users WHERE phone = '${adminPhone}');`,
    "check seeded admin user"
  ) === "t";

  if (!seedExists) {
    console.log("Admin user not found. Inserting admin seed data...");
    
    // Insert admin user directly
    const insertAdminSql = `
      INSERT INTO users (phone, country_code, name, email, role, status) 
      VALUES ('${adminPhone}', '+91', 'Yajman Admin', 'admin@yajmanapp.in', 'admin', 'active');
    `;
    
    querySql(insertAdminSql, "insert admin user");
    console.log("✅ Admin user seeded successfully! (Phone: 8109181057)");
  } else {
    console.log("✅ Admin user already exists, skipping seed.");
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
