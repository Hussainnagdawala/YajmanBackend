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

  DATABASE_URL: z.string().min(1, "postgresql://postgres@localhost:5432/yajman"),
  DB_POOL_MIN: z.string().default("2").transform(Number),
  DB_POOL_MAX: z.string().default("10").transform(Number),

  JWT_SECRET: z.string().min(1, "dev-secret-key-for-local-testing"),
  JWT_ACCESS_EXPIRY: z.string().default("24h"),
  JWT_REFRESH_EXPIRY: z.string().default("30d"),

  OTP_PROVIDER: z.string().default("msg91"),
  OTP_API_KEY: z.string().default(""),
  OTP_SENDER_ID: z.string().default("YAJMAN"),
  OTP_TEMPLATE_ID: z.string().default(""),
  OTP_EXPIRY_MINUTES: z.string().default("10").transform(Number),

  // WhatsApp Cloud API (Meta Graph) — used when OTP_PROVIDER=whatsapp
  WHATSAPP_ACCESS_TOKEN: z.string().default(""),
  WHATSAPP_PHONE_NUMBER_ID: z.string().default(""),
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().default(""),
  WHATSAPP_GRAPH_VERSION: z.string().default("v21.0"),
  WHATSAPP_OTP_TEMPLATE: z.string().default("otp"),
  WHATSAPP_OTP_LANG: z.string().default("en"),
  // authentication templates carry a copy-code button by default; set to "false"
  // only if your template has no button component
  WHATSAPP_OTP_HAS_BUTTON: z.string().default("true").transform((v) => v !== "false"),

  // WABA NXC (BSP) — used when OTP_PROVIDER=nxc
  NXC_API_URL: z.string().default("https://waba.nxccontrols.in/api/create-message-json"),
  NXC_APP_KEY: z.string().default("85076757-3167-421b-ba7f-af30ba0a8bb2"),
  NXC_AUTH_KEY: z.string().default("UfOMLdyv9L8QKeMYId7zQzoFot59m7AQUDkRFoMnRgERZse72V"),
  NXC_OTP_TEMPLATE_ID: z.string().default("otp_mobile_verification"),
  // Must match the approved template locale in NXC (otp_mobile_verification is hi)
  NXC_OTP_LANG: z.string().default("hi"),
  // Copy-code URL button needs its own button[{buttonKey1}] field (not body {{2}})
  NXC_OTP_HAS_BUTTON: z.string().default("true").transform((v) => v !== "false"),

  RAZORPAY_KEY_ID: z.string().min(1, "rzp_test_TJqNPpeSwePE3V"),
  RAZORPAY_KEY_SECRET: z.string().min(1, "TnBOU6WPArVng6u6QsMCx05J"),
  RAZORPAY_WEBHOOK_SECRET: z.string().min(1, "dummy"),

  DO_SPACES_KEY: z.string().min(1, "DO80183G3347LXHWRHVY"),
  DO_SPACES_SECRET: z.string().min(1, "KqmK/rjaKnmLOLbAAKhmGHZbYv5VpmEFCrhS6V0JmfA"),
  DO_SPACES_ENDPOINT: z.string().min(1, "https://blr1.digitaloceanspaces.com"),
  DO_SPACES_BUCKET: z.string().min(1, "yajmanbucket"),
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
  RATE_LIMIT_MAX_REQUESTS: z.string().default("100").transform(Number),

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
