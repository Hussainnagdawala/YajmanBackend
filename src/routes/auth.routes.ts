import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { validate } from "../middleware/validate";
import { authenticate } from "../middleware/auth";
import { otpRateLimiter } from "../middleware/rateLimiter";
import { sendOtpSchema, verifyOtpSchema, refreshTokenSchema } from "../validators/auth.schema";

const router = Router();

router.post("/send-otp", otpRateLimiter, validate(sendOtpSchema), authController.sendOtp);
router.post("/verify-otp", validate(verifyOtpSchema), authController.verifyOtp);
router.post("/refresh-token", validate(refreshTokenSchema), authController.refreshToken);
router.post("/logout", authenticate, authController.logout);
router.get("/me", authenticate, authController.me);

export default router;
