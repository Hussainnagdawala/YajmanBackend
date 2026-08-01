import { Router } from "express";
import * as homeController from "../../controllers/home.controller";
import { validate } from "../../middleware/validate";
import { createRecommendedServiceSchema, updateRecommendedServiceSchema } from "../../validators/home.schema";

const router = Router();

/**
 * @openapi
 * /admin/recommended-services:
 *   post:
 *     tags: [Admin: Recommended Services]
 *     summary: Add a service to a recommended-services section
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [service_id]
 *             properties:
 *               service_id: { type: string, format: uuid }
 *               page: { type: string, maxLength: 50, default: home }
 *               section: { type: string, maxLength: 50, default: recommended }
 *               display_order: { type: integer, default: 0 }
 *     responses:
 *       201:
 *         description: Recommended service created
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
 *                         id: { type: string, format: uuid }
 *                         service_id: { type: string, format: uuid }
 *                         page: { type: string }
 *                         section: { type: string }
 *                         display_order: { type: integer }
 *                         is_active: { type: boolean }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post("/", validate(createRecommendedServiceSchema), homeController.createRecommendedService);

/**
 * @openapi
 * /admin/recommended-services:
 *   get:
 *     tags: [Admin: Recommended Services]
 *     summary: List recommended services (all, or filtered to one page+section when both are given)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: string }
 *         description: Filter by page. Must be combined with `section` — if either is omitted, all recommended services are returned.
 *       - in: query
 *         name: section
 *         schema: { type: string }
 *         description: Filter by section. Must be combined with `page`.
 *     responses:
 *       200:
 *         description: Recommended services list
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
router.get("/", homeController.listRecommendedServicesAdmin);

/**
 * @openapi
 * /admin/recommended-services/{id}:
 *   patch:
 *     tags: [Admin: Recommended Services]
 *     summary: Update a recommended-service entry
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               service_id: { type: string, format: uuid }
 *               page: { type: string, maxLength: 50 }
 *               section: { type: string, maxLength: 50 }
 *               display_order: { type: integer }
 *               is_active: { type: boolean }
 *     responses:
 *       200:
 *         description: Recommended service updated
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.patch("/:id", validate(updateRecommendedServiceSchema), homeController.updateRecommendedService);

/**
 * @openapi
 * /admin/recommended-services/{id}:
 *   delete:
 *     tags: [Admin: Recommended Services]
 *     summary: Soft-delete a recommended-service entry
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Recommended service deleted
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.delete("/:id", homeController.deleteRecommendedService);

/**
 * @openapi
 * /admin/recommended-services/{id}/permanent:
 *   delete:
 *     tags: [Admin: Recommended Services]
 *     summary: Permanently delete a recommended-service entry
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Recommended service permanently deleted
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.delete("/:id/permanent", homeController.deleteRecommendedServicePermanently);

export default router;
