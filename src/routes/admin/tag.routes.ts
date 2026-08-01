import { Router } from "express";
import * as tagController from "../../controllers/tag.controller";
import { validate } from "../../middleware/validate";
import { createTagSchema, updateTagSchema } from "../../validators/category.schema";

const router = Router();

/**
 * @openapi
 * /admin/tags:
 *   post:
 *     tags: [Admin: Tags]
 *     summary: Create a tag
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, maxLength: 50 }
 *               color: { type: string, pattern: '^#[0-9a-fA-F]{6}$', example: '#ffffff' }
 *               bg_color: { type: string, pattern: '^#[0-9a-fA-F]{6}$', example: '#000000' }
 *               display_order: { type: integer, default: 0 }
 *     responses:
 *       201:
 *         description: Tag created
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
router.post("/", validate(createTagSchema), tagController.createTag);

/**
 * @openapi
 * /admin/tags:
 *   get:
 *     tags: [Admin: Tags]
 *     summary: List all tags (including inactive)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Tags fetched
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
router.get("/", tagController.listTagsAdmin);

/**
 * @openapi
 * /admin/tags/{id}:
 *   patch:
 *     tags: [Admin: Tags]
 *     summary: Update a tag
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string, maxLength: 50 }
 *               color: { type: string, pattern: '^#[0-9a-fA-F]{6}$' }
 *               bg_color: { type: string, pattern: '^#[0-9a-fA-F]{6}$' }
 *               display_order: { type: integer }
 *               is_active: { type: boolean }
 *     responses:
 *       200:
 *         description: Tag updated
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
router.patch("/:id", validate(updateTagSchema), tagController.updateTag);

/**
 * @openapi
 * /admin/tags/{id}:
 *   delete:
 *     tags: [Admin: Tags]
 *     summary: Soft-delete a tag
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Tag deleted
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
router.delete("/:id", tagController.deleteTag);

/**
 * @openapi
 * /admin/tags/{id}/permanent:
 *   delete:
 *     tags: [Admin: Tags]
 *     summary: Permanently delete a tag
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Tag permanently deleted
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
router.delete("/:id/permanent", tagController.deleteTagPermanently);

export default router;
