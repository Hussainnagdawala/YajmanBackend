import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

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

  RAZORPAY_KEY_ID: z.string().min(1, "RAZORPAY_KEY_ID is required"),
  RAZORPAY_KEY_SECRET: z.string().min(1, "RAZORPAY_KEY_SECRET is required"),
  RAZORPAY_WEBHOOK_SECRET: z.string().min(1, "RAZORPAY_WEBHOOK_SECRET is required"),

  AWS_ACCESS_KEY_ID: z.string().min(1, "AWS_ACCESS_KEY_ID is required"),
  AWS_SECRET_ACCESS_KEY: z.string().min(1, "AWS_SECRET_ACCESS_KEY is required"),
  AWS_REGION: z.string().default("ap-south-1"),
  S3_BUCKET: z.string().min(1, "S3_BUCKET is required"),

  FRONTEND_URL: z.string().default("http://localhost:3000"),
  ADMIN_PORTAL_URL: z.string().default("http://localhost:3002"),
  CORS_ORIGINS: z.string().default("*"),

  RATE_LIMIT_WINDOW_MS: z.string().default("900000").transform(Number),
  RATE_LIMIT_MAX_REQUESTS: z.string().default("100").transform(Number),
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
