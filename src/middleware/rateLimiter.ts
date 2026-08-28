import rateLimit from "express-rate-limit";
import { env } from "../config/env";

export const globalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
});

export const otpRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.body?.phone || req.ip || "unknown",
  message: { success: false, error: { message: "Too many OTP requests, try again later", status: 429 } },
});

/** Admin Excel exports — prevent abuse of large DB reads */
export const exportRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id ?? req.ip ?? "unknown",
  message: { success: false, error: { message: "Too many export requests, try again later", status: 429 } },
});
