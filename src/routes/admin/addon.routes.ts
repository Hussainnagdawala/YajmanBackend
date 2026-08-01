import { Router, Request, Response, NextFunction } from "express";
import * as addonController from "../../controllers/addon.controller";
import { validate } from "../../middleware/validate";
import { uploadSingle } from "../../middleware/upload";
import { createAddonSchema, updateAddonSchema } from "../../validators/addon.schema";

const router = Router();

const setUploadFolder = (req: Request, _res: Response, next: NextFunction) => {
  req.uploadFolder = "addons";
  next();
};

/**
 * @openapi
 * /admin/addons:
 *   post:
 *     tags: [Admin: Addons]
 *     summary: Create an addon (multipart, optional image upload). Price is required unless is_free is true.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, maxLength: 100 }
 *               price: { type: number, minimum: 0, description: 'Required (and > 0) unless is_free is true' }
 *               is_free: { type: boolean, default: false }
 *               display_order: { type: integer, default: 0 }
 *               image: { type: string, format: binary }
 *     responses:
 *       201:
 *         description: Addon created
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post("/", setUploadFolder, uploadSingle("image"), validate(createAddonSchema), addonController.createAddon);

/**
 * @openapi
 * /admin/addons:
 *   get:
 *     tags: [Admin: Addons]
 *     summary: List all addons (including inactive)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Addons fetched
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
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get("/", addonController.listAddonsAdmin);

/**
 * @openapi
 * /admin/addons/{id}:
 *   patch:
 *     tags: [Admin: Addons]
 *     summary: Update an addon (multipart, optional image replacement). Setting is_free to true zeroes out price.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string, maxLength: 100 }
 *               price: { type: number, minimum: 0 }
 *               is_free: { type: boolean }
 *               display_order: { type: integer }
 *               is_active: { type: boolean }
 *               image: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Addon updated
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *       400:
 *         description: Validation error, or no fields provided to update
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.patch("/:id", setUploadFolder, uploadSingle("image"), validate(updateAddonSchema), addonController.updateAddon);

/**
 * @openapi
 * /admin/addons/{id}:
 *   delete:
 *     tags: [Admin: Addons]
 *     summary: Soft-delete an addon
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Addon deleted
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
router.delete("/:id", addonController.deleteAddon);

/**
 * @openapi
 * /admin/addons/{id}/permanent:
 *   delete:
 *     tags: [Admin: Addons]
 *     summary: Permanently delete an addon and its uploaded image
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Addon permanently deleted
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
router.delete("/:id/permanent", addonController.deleteAddonPermanently);

export default router;
