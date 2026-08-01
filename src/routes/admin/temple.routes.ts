import { Router, Request, Response, NextFunction } from "express";
import * as serviceController from "../../controllers/service.controller";
import { validate } from "../../middleware/validate";
import { uploadSingle } from "../../middleware/upload";
import { createTempleSchema, updateTempleSchema } from "../../validators/service.schema";

const router = Router();

const setUploadFolder = (req: Request, _res: Response, next: NextFunction) => {
  req.uploadFolder = "temples";
  next();
};

/**
 * @openapi
 * /admin/temples:
 *   post:
 *     tags: [Admin: Temples]
 *     summary: Create a temple (multipart, optional image upload)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, maxLength: 200 }
 *               description: { type: string }
 *               address: { type: string }
 *               city: { type: string, maxLength: 100 }
 *               state: { type: string, maxLength: 100 }
 *               latitude: { type: number }
 *               longitude: { type: number }
 *               image: { type: string, format: binary }
 *     responses:
 *       201:
 *         description: Temple created
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
router.post("/", setUploadFolder, uploadSingle("image"), validate(createTempleSchema), serviceController.createTemple);

/**
 * @openapi
 * /admin/temples:
 *   get:
 *     tags: [Admin: Temples]
 *     summary: List all temples (including inactive)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Temples fetched
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
router.get("/", serviceController.listTemplesAdmin);

/**
 * @openapi
 * /admin/temples/{id}:
 *   patch:
 *     tags: [Admin: Temples]
 *     summary: Update a temple (multipart, optional image replacement)
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
 *               name: { type: string, maxLength: 200 }
 *               description: { type: string }
 *               address: { type: string }
 *               city: { type: string, maxLength: 100 }
 *               state: { type: string, maxLength: 100 }
 *               latitude: { type: number }
 *               longitude: { type: number }
 *               is_active: { type: boolean }
 *               image: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Temple updated
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
router.patch("/:id", setUploadFolder, uploadSingle("image"), validate(updateTempleSchema), serviceController.updateTemple);

/**
 * @openapi
 * /admin/temples/{id}:
 *   delete:
 *     tags: [Admin: Temples]
 *     summary: Soft-delete a temple
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Temple deleted
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
router.delete("/:id", serviceController.deleteTemple);

/**
 * @openapi
 * /admin/temples/{id}/permanent:
 *   delete:
 *     tags: [Admin: Temples]
 *     summary: Permanently delete a temple and its uploaded image
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Temple permanently deleted
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
router.delete("/:id/permanent", serviceController.deleteTemplePermanently);

export default router;
