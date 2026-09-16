import { Router, Request, Response, NextFunction } from "express";
import * as typeController from "../../controllers/type.controller";
import { validate } from "../../middleware/validate";
import { uploadFields } from "../../middleware/upload";
import { createTypeSchema, updateTypeSchema } from "../../validators/category.schema";

const router = Router();

const setUploadFolder = (req: Request, _res: Response, next: NextFunction) => {
  req.uploadFolder = "types";
  next();
};

const typeUpload = uploadFields([
  { name: "image", maxCount: 1 },
  { name: "icon", maxCount: 1 },
]);

/**
 * @openapi
 * /admin/types:
 *   post:
 *     tags: [Admin: Types]
 *     summary: Create a type (multipart, optional image/icon upload)
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
 *               description: { type: string }
 *               display_order: { type: integer, default: 0 }
 *               image: { type: string, format: binary }
 *               icon: { type: string, format: binary }
 *     responses:
 *       201:
 *         description: Type created
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
router.post("/", setUploadFolder, typeUpload, validate(createTypeSchema), typeController.createType);

/**
 * @openapi
 * /admin/types:
 *   get:
 *     tags: [Admin: Types]
 *     summary: List all types (including inactive)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Types fetched
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
router.get("/", typeController.listTypesAdmin);

/**
 * @openapi
 * /admin/types/{id}:
 *   patch:
 *     tags: [Admin: Types]
 *     summary: Update a type (multipart, optional image/icon replacement)
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
 *               description: { type: string }
 *               display_order: { type: integer }
 *               is_active: { type: boolean }
 *               image: { type: string, format: binary }
 *               icon: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Type updated
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
router.patch("/:id", setUploadFolder, typeUpload, validate(updateTypeSchema), typeController.updateType);

/**
 * @openapi
 * /admin/types/{id}:
 *   delete:
 *     tags: [Admin: Types]
 *     summary: Soft-delete a type
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Type deleted
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
router.delete("/:id", typeController.deleteType);

/**
 * @openapi
 * /admin/types/{id}/permanent:
 *   delete:
 *     tags: [Admin: Types]
 *     summary: Permanently delete a type and its uploaded image (blocked if services are still linked to it)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Type permanently deleted
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: Type has linked services and cannot be deleted
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 */
router.delete("/:id/permanent", typeController.deleteTypePermanently);

export default router;
