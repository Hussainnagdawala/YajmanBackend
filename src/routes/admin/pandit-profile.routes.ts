import { Router, Request, Response, NextFunction } from "express";
import * as panditController from "../../controllers/pandit.controller";
import { validate } from "../../middleware/validate";
import { uploadSingle } from "../../middleware/upload";
import {
  listPanditsAdminQuerySchema,
  listAvailablePanditsQuerySchema,
  updatePanditProfileAdminSchema,
} from "../../validators/pandit.schema";

const router = Router();

const setUploadFolder = (req: Request, _res: Response, next: NextFunction) => {
  req.uploadFolder = "pandits";
  next();
};

/**
 * @openapi
 * /admin/pandits:
 *   get:
 *     tags: [Admin: Pandits]
 *     summary: List pandit profiles (joins pandit_profiles with users for rating/availability)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Matches display_name or phone
 *       - in: query
 *         name: is_available
 *         schema: { type: boolean }
 *       - in: query
 *         name: is_verified
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: Pandits fetched
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: array, items: { type: object } }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get("/", validate(listPanditsAdminQuerySchema, "query"), panditController.listPanditsAdmin);

/**
 * @openapi
 * /admin/pandits/available:
 *   get:
 *     tags: [Admin: Pandits]
 *     summary: List pandits available (not double-booked) at a given date/time, for the assignment picker
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: date
 *         required: true
 *         schema: { type: string, pattern: '^\d{4}-\d{2}-\d{2}$' }
 *       - in: query
 *         name: time
 *         required: true
 *         schema: { type: string, pattern: '^\d{2}:\d{2}(:\d{2})?$' }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Matches display_name or phone
 *       - in: query
 *         name: is_verified
 *         schema: { type: boolean }
 *       - in: query
 *         name: city
 *         schema: { type: string }
 *         description: Matches an entry in the pandit's service_areas
 *     responses:
 *       200:
 *         description: Available pandits fetched
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: array, items: { type: object } }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
// Must come before "/:id" — otherwise "available" is captured as the :id param.
router.get("/available", validate(listAvailablePanditsQuerySchema, "query"), panditController.listAvailablePandits);

/**
 * @openapi
 * /admin/pandits/{id}:
 *   get:
 *     tags: [Admin: Pandits]
 *     summary: Get a single pandit profile by id
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: pandit_profiles.id
 *     responses:
 *       200:
 *         description: Pandit fetched
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get("/:id", panditController.getPanditAdmin);

/**
 * @openapi
 * /admin/pandits/{id}:
 *   patch:
 *     tags: [Admin: Pandits]
 *     summary: Update a pandit's profile, including admin-only verification/KYC fields
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: pandit_profiles.id
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               display_name: { type: string, minLength: 1, maxLength: 100 }
 *               bio: { type: string }
 *               experience_years: { type: integer, minimum: 0 }
 *               specializations:
 *                 type: string
 *                 description: JSON-encoded array of strings, e.g. '["Satyanarayan Puja","Griha Pravesh"]'
 *               languages:
 *                 type: string
 *                 description: JSON-encoded array of strings
 *               service_areas:
 *                 type: string
 *                 description: JSON-encoded array of strings
 *               is_available: { type: boolean }
 *               is_verified: { type: boolean }
 *               aadhaar_number: { type: string, pattern: '^\d{12}$' }
 *               profile_image: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Pandit profile updated
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.patch(
  "/:id",
  setUploadFolder,
  uploadSingle("profile_image"),
  validate(updatePanditProfileAdminSchema),
  panditController.updatePanditAdmin
);

export default router;
