import { Router } from "express";
import * as settingsController from "../../controllers/admin/settings.controller";
import { validate } from "../../middleware/validate";
import {
  listSettingsQuerySchema,
  settingKeyParamSchema,
  bulkUpdateSettingsSchema,
  patchSettingSchema,
} from "../../validators/settings.schema";

const router = Router();

/**
 * @openapi
 * /admin/app-settings:
 *   get:
 *     tags: [Admin: App Settings]
 *     summary: List all app settings, optionally filtered by category, grouped by category
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [general, android, ios, features, support, social, notifications, media, booking, location, security, behaviour, system]
 *     responses:
 *       200:
 *         description: Settings fetched, grouped by category
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       additionalProperties:
 *                         type: array
 *                         items: { type: object }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get("/", validate(listSettingsQuerySchema, "query"), settingsController.listSettings);

/**
 * @openapi
 * /admin/app-settings:
 *   put:
 *     tags: [Admin: App Settings]
 *     summary: Bulk-update settings, either as a flat key map or grouped by category
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Provide at least one of `settings` or `categories`
 *             properties:
 *               settings:
 *                 type: object
 *                 additionalProperties: true
 *                 description: Flat map of setting key -> new value
 *               categories:
 *                 type: object
 *                 additionalProperties:
 *                   type: object
 *                   additionalProperties: true
 *                 description: Map of category -> (setting key -> new value)
 *     responses:
 *       200:
 *         description: Settings updated
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *       400:
 *         description: Validation error (missing settings/categories, unknown key, or value does not match the setting's value_type)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Authenticated but not admin, or the setting is not editable
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       404:
 *         description: One of the given setting keys does not exist
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 */
router.put("/", validate(bulkUpdateSettingsSchema), settingsController.bulkUpdateSettings);

/**
 * @openapi
 * /admin/app-settings/{key}:
 *   get:
 *     tags: [Admin: App Settings]
 *     summary: Get a single setting by key
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema: { type: string, minLength: 1, maxLength: 100 }
 *     responses:
 *       200:
 *         description: Setting fetched
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
 *                         key: { type: string }
 *                         value: {}
 *                         raw_value: { type: string }
 *                         value_type: { type: string, enum: [string, number, boolean, json] }
 *                         is_public: { type: boolean }
 *                         is_editable: { type: boolean }
 *                         description: { type: string, nullable: true }
 *                         category: { type: string }
 *                         updated_at: { type: string, format: date-time }
 *                         updated_by: { type: string, format: uuid, nullable: true }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get("/:key", validate(settingKeyParamSchema, "params"), settingsController.getSetting);

/**
 * @openapi
 * /admin/app-settings/{key}:
 *   patch:
 *     tags: [Admin: App Settings]
 *     summary: Update a single setting's value
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema: { type: string, minLength: 1, maxLength: 100 }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [value]
 *             properties:
 *               value: {}
 *     responses:
 *       200:
 *         description: Setting updated
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *       400:
 *         description: Validation error, unknown setting key, or value does not match the setting's value_type
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Authenticated but not admin, or the setting is not editable
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.patch(
  "/:key",
  validate(settingKeyParamSchema, "params"),
  validate(patchSettingSchema),
  settingsController.patchSetting
);

export default router;
