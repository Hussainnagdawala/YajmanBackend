import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { validate } from "../middleware/validate";
import { authenticate } from "../middleware/auth";
import { otpRateLimiter } from "../middleware/rateLimiter";
import { sendOtpSchema, verifyOtpSchema, refreshTokenSchema } from "../validators/auth.schema";

const router = Router();

/**
 * @openapi
 * /auth/send-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Send a login OTP to a phone number
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone]
 *             properties:
 *               phone:
 *                 type: string
 *                 pattern: '^[6-9]\d{9}$'
 *                 example: '9876543210'
 *               country_code:
 *                 type: string
 *                 example: '+91'
 *     responses:
 *       200:
 *         description: OTP sent
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         expires_in: { type: integer, example: 600 }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       429:
 *         description: Too many OTP requests
 */
router.post("/send-otp", otpRateLimiter, validate(sendOtpSchema), authController.sendOtp);

/**
 * @openapi
 * /auth/verify-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Verify OTP and obtain access/refresh tokens (creates the user on first login)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone, otp]
 *             properties:
 *               phone: { type: string, example: '9876543210' }
 *               country_code: { type: string, example: '+91' }
 *               otp: { type: string, minLength: 6, maxLength: 6, example: '123456' }
 *               device_source: { type: string, enum: [web, app, portal], default: web }
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         access_token: { type: string }
 *                         refresh_token: { type: string }
 *                         expires_in: { type: integer, example: 86400 }
 *                         is_new_user: { type: boolean }
 *                         user:
 *                           type: object
 *                           properties:
 *                             id: { type: string, format: uuid }
 *                             phone: { type: string }
 *                             role: { type: string, enum: [customer, pandit, admin] }
 *                             name: { type: string, nullable: true }
 *       400:
 *         description: Invalid/expired OTP, too many attempts, or validation error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 */
router.post("/verify-otp", validate(verifyOtpSchema), authController.verifyOtp);

/**
 * @openapi
 * /auth/refresh-token:
 *   post:
 *     tags: [Auth]
 *     summary: Exchange a refresh token for a new access + refresh token pair (rotates the refresh token)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refresh_token]
 *             properties:
 *               refresh_token: { type: string }
 *     responses:
 *       200:
 *         description: New token pair
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         access_token: { type: string }
 *                         refresh_token: { type: string }
 *                         expires_in: { type: integer, example: 86400 }
 *       400:
 *         description: Refresh token invalid, expired, or already revoked
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 */
router.post("/refresh-token", validate(refreshTokenSchema), authController.refreshToken);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Revoke a refresh token
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refresh_token: { type: string }
 *     responses:
 *       200:
 *         description: Logged out
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post("/logout", authenticate, authController.logout);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get the current logged-in user
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Current user
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get("/me", authenticate, authController.me);

export default router;
