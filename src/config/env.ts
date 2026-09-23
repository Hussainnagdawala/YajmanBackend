import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

// Pin the process timezone so any local-time read (e.g. invoice.service.ts's
// `new Date().getFullYear()` for invoice numbering) is deterministic
// regardless of the host machine's clock setting. Every date/time value this
// app actually cares about is already timezone-explicit elsewhere (TIMESTAMPTZ
// columns, or toISTDateTime's hardcoded +05:30) — this only removes the one
// remaining implicit dependency on the server's local clock.
process.env.TZ = process.env.TZ || "UTC";

const envSchema = z.object({
  PORT: z.string().default("3001").transform(Number),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  API_VERSION: z.string().default("v1"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DB_POOL_MIN: z.string().default("2").transform(Number),
  DB_POOL_MAX: z.string().default("10").transform(Number),

  JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
  JWT_ACCESS_EXPIRY: z.string().default("24h"),
  JWT_REFRESH_EXPIRY: z.string().default("30d"),

  OTP_PROVIDER: z.string().default("msg91"),
  OTP_API_KEY: z.string().default(""),
  OTP_SENDER_ID: z.string().default("YAJMAN"),
  OTP_TEMPLATE_ID: z.string().default(""),
  OTP_EXPIRY_MINUTES: z.string().default("10").transform(Number),

  // WhatsApp Cloud API (Meta Graph) — used when OTP_PROVIDER=whatsapp
  // WHATSAPP_ACCESS_TOKEN: z.string().default(""),
  // WHATSAPP_PHONE_NUMBER_ID: z.string().default(""),
  // WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().default(""),
  // WHATSAPP_GRAPH_VERSION: z.string().default("v21.0"),
  // WHATSAPP_OTP_TEMPLATE: z.string().default("otp"),
  // WHATSAPP_OTP_LANG: z.string().default("en"),
  // authentication templates carry a copy-code button by default; set to "false"
  // only if your template has no button component
  // WHATSAPP_OTP_HAS_BUTTON: z.string().default("true").transform((v) => v !== "false"),

  // WABA NXC (BSP) — used when OTP_PROVIDER=nxc
  NXC_API_URL: z.string().default("https://waba.nxccontrols.in/api/create-message"),
  NXC_APP_KEY: z.string().default(""),
  NXC_AUTH_KEY: z.string().default(""),
  NXC_OTP_TEMPLATE_ID: z.string().default(""),
  NXC_OTP_LANG: z.string().default("en_us"),
  // set to "false" if the template's button has no dynamic URL variable
  NXC_OTP_HAS_BUTTON: z.string().default("true").transform((v) => v !== "false"),
  // Invoice / booking confirmation (NXC "Variable With PDF" template)
  NXC_INVOICE_TEMPLATE_ID: z.string().default("complete_booking"),
  NXC_INVOICE_LANG: z.string().default("en_US"),
  // Booking cancellation / refund status (plain text template, no PDF)
  NXC_CANCELLATION_TEMPLATE_ID: z.string().default(""),
  NXC_CANCELLATION_LANG: z.string().default("en_US"),

  RAZORPAY_KEY_ID: z.string().min(1, "RAZORPAY_KEY_ID is required"),
  RAZORPAY_KEY_SECRET: z.string().min(1, "RAZORPAY_KEY_SECRET is required"),
  RAZORPAY_WEBHOOK_SECRET: z.string().min(1, "RAZORPAY_WEBHOOK_SECRET is required"),

  DO_SPACES_KEY: z.string().min(1, "DO_SPACES_KEY is required"),
  DO_SPACES_SECRET: z.string().min(1, "DO_SPACES_SECRET is required"),
  DO_SPACES_ENDPOINT: z.string().min(1, "DO_SPACES_ENDPOINT is required"),
  DO_SPACES_BUCKET: z.string().min(1, "DO_SPACES_BUCKET is required"),
  // Trim stray whitespace and slashes — an empty or "/"-padded value used to
  // produce leading-slash S3 keys (e.g. "/invoices/x.pdf") that then 404 on
  // download because the read path strips leading slashes.
  DO_PARENT_FOLDER: z
    .string()
    .default("YJ-stagging")
    .transform((v) => v.trim().replace(/^\/+|\/+$/g, "")),


  FRONTEND_URL: z.string().default("http://localhost:3000"),
  ADMIN_PORTAL_URL: z.string().default("http://localhost:3002"),
  CORS_ORIGINS: z.string().default("*"),

  RATE_LIMIT_WINDOW_MS: z.string().default("900000").transform(Number),
  // Public pages fire many parallel GETs (banners, placements, catalog). 100/15min
  // per IP is too low for a marketing site — one home load plus a few navigations
  // returns 429 "Too many requests".
  RATE_LIMIT_MAX_REQUESTS: z.string().default("1000").transform(Number),

  // Firebase / FCM — optional in local/dev; push no-ops when unset
  FIREBASE_PROJECT_ID: z.string().optional().default(""),
  FIREBASE_CLIENT_EMAIL: z.string().optional().default(""),
  FIREBASE_PRIVATE_KEY: z.string().optional().default(""),
  FIREBASE_SERVICE_ACCOUNT_PATH: z.string().optional().default(""),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  CORS_ORIGINS_LIST: parsed.data.CORS_ORIGINS.split(",").map((origin) => origin.trim()),
};
