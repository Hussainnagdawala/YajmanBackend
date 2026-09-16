import { Router } from "express";
import * as appSettingsController from "../controllers/app-settings.controller";
import { validate } from "../middleware/validate";
import { publicSettingsQuerySchema } from "../validators/settings.schema";

const router = Router();

/**
 * @openapi
 * /app/settings:
 *   get:
 *     tags: [App]
 *     summary: Get public app settings (optionally filtered/adjusted by platform and app version). Supports ETag/If-None-Match — returns 304 with no body when unchanged.
 *     parameters:
 *       - in: query
 *         name: platform
 *         schema: { type: string, enum: [android, ios] }
 *       - in: query
 *         name: app_version
 *         schema: { type: string, maxLength: 30 }
 *     responses:
 *       200:
 *         description: Public app settings
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *       304:
 *         description: Not modified (ETag matches If-None-Match)
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.get(
  "/settings",
  validate(publicSettingsQuerySchema, "query"),
  appSettingsController.getAppSettings
);

export default router;
