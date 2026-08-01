import { Router, Request, Response, NextFunction } from "express";
import * as profileController from "../controllers/profile.controller";
import { validate } from "../middleware/validate";
import { uploadSingle } from "../middleware/upload";
import { updateProfileSchema } from "../validators/profile.schema";
import { registerDeviceTokenSchema, removeDeviceTokenSchema } from "../validators/device.schema";

const router = Router();

/**
 * @openapi
 * /profile:
 *   get:
 *     tags: [Profile]
 *     summary: Get the current logged-in user's own profile
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Profile fetched
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get("/", profileController.getProfile);

/**
 * @openapi
 * /profile:
 *   patch:
 *     tags: [Profile]
 *     summary: Update the current logged-in user's own profile
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string, maxLength: 100 }
 *               email: { type: string, format: email, maxLength: 150 }
 *               whatsapp_number: { type: string, pattern: '^[6-9]\d{9}$' }
 *               calling_number: { type: string, pattern: '^[6-9]\d{9}$' }
 *               gender: { type: string, enum: [Male, Female, Other] }
 *               date_of_birth: { type: string, pattern: '^\d{4}-\d{2}-\d{2}$' }
 *               time_of_birth: { type: string, pattern: '^\d{2}:\d{2}$' }
 *               place_of_birth: { type: string, maxLength: 150 }
 *     responses:
 *       200:
 *         description: Profile updated
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.patch("/", validate(updateProfileSchema), profileController.updateProfile);

/**
 * @openapi
 * /profile/avatar:
 *   post:
 *     tags: [Profile]
 *     summary: Upload/replace the current user's avatar image
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [avatar]
 *             properties:
 *               avatar: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Avatar updated
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *       400:
 *         description: Avatar file is required
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post(
  "/avatar",
  (req: Request, _res: Response, next: NextFunction) => {
    req.uploadFolder = "avatars";
    next();
  },
  uploadSingle("avatar"),
  profileController.uploadAvatar
);

/**
 * @openapi
 * /profile/device-tokens:
 *   post:
 *     tags: [Profile]
 *     summary: Register (or refresh) a push-notification device token for the current user
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, platform]
 *             properties:
 *               token: { type: string, minLength: 1 }
 *               platform: { type: string, enum: [web, android, ios] }
 *               device_info:
 *                 type: object
 *                 additionalProperties: true
 *     responses:
 *       201:
 *         description: Device token registered
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post("/device-tokens", validate(registerDeviceTokenSchema), profileController.registerDeviceToken);

/**
 * @openapi
 * /profile/device-tokens:
 *   get:
 *     tags: [Profile]
 *     summary: List the current user's registered device tokens
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Device tokens fetched
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { type: object }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get("/device-tokens", profileController.listDeviceTokens);

/**
 * @openapi
 * /profile/device-tokens:
 *   delete:
 *     tags: [Profile]
 *     summary: Deactivate/remove a device token for the current user
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token: { type: string, minLength: 1 }
 *     responses:
 *       200:
 *         description: Device token removed
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete("/device-tokens", validate(removeDeviceTokenSchema), profileController.removeDeviceToken);

export default router;
