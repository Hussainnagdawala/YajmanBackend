import { Router } from "express";
import * as homeController from "../../controllers/home.controller";
import { validate } from "../../middleware/validate";
import { createPopularSearchSchema, updatePopularSearchSchema } from "../../validators/home.schema";

const router = Router();

/**
 * @openapi
 * /admin/popular-searches:
 *   post:
 *     tags: [Admin: Popular Searches]
 *     summary: Create a popular search entry
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [label]
 *             properties:
 *               label: { type: string, maxLength: 100 }
 *               link_url: { type: string, maxLength: 500 }
 *               display_order: { type: integer, default: 0 }
 *               row_number: { type: integer, minimum: 1, maximum: 2, default: 1 }
 *     responses:
 *       201:
 *         description: Popular search created
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
router.post("/", validate(createPopularSearchSchema), homeController.createPopularSearch);

/**
 * @openapi
 * /admin/popular-searches:
 *   get:
 *     tags: [Admin: Popular Searches]
 *     summary: List all popular search entries (including inactive)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Popular searches fetched
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
router.get("/", homeController.listPopularSearchesAdmin);

/**
 * @openapi
 * /admin/popular-searches/{id}:
 *   patch:
 *     tags: [Admin: Popular Searches]
 *     summary: Update a popular search entry
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
 *               label: { type: string, maxLength: 100 }
 *               link_url: { type: string, maxLength: 500 }
 *               display_order: { type: integer }
 *               row_number: { type: integer, minimum: 1, maximum: 2 }
 *               is_active: { type: boolean }
 *     responses:
 *       200:
 *         description: Popular search updated
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
router.patch("/:id", validate(updatePopularSearchSchema), homeController.updatePopularSearch);

/**
 * @openapi
 * /admin/popular-searches/{id}:
 *   delete:
 *     tags: [Admin: Popular Searches]
 *     summary: Soft-delete a popular search entry
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Popular search deleted
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
router.delete("/:id", homeController.deletePopularSearch);

/**
 * @openapi
 * /admin/popular-searches/{id}/permanent:
 *   delete:
 *     tags: [Admin: Popular Searches]
 *     summary: Permanently delete a popular search entry
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Popular search permanently deleted
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
router.delete("/:id/permanent", homeController.deletePopularSearchPermanently);

export default router;
