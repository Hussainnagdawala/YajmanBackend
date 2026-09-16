import { Router } from "express";
import * as placementController from "../../controllers/service-placement.controller";
import { validate } from "../../middleware/validate";
import {
  createServicePlacementSchema,
  updateServicePlacementSchema,
  listServicePlacementsAdminQuerySchema,
} from "../../validators/service-placement.schema";

const router = Router();

/**
 * @openapi
 * /admin/service-placements/catalog:
 *   get:
 *     tags: [Admin: Service Placements]
 *     summary: List valid page + section combinations for the admin UI
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Placement catalog
 */
router.get("/catalog", placementController.getPlacementCatalog);

/**
 * @openapi
 * /admin/service-placements:
 *   post:
 *     tags: [Admin: Service Placements]
 *     summary: Assign a service to a page section (sidebar, inline_ad, etc.)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [service_id, page, section, display_order]
 *             properties:
 *               service_id: { type: string, format: uuid }
 *               page: { type: string, enum: [home, blogs, articles, aayojan] }
 *               section: { type: string, enum: [sidebar, recommended, inline_ad, related] }
 *               display_order: { type: integer, minimum: 0 }
 *               label: { type: string, maxLength: 100 }
 *               cta_text: { type: string, maxLength: 50 }
 *               starts_at: { type: string, format: date-time, nullable: true }
 *               ends_at: { type: string, format: date-time, nullable: true }
 *     responses:
 *       201:
 *         description: Service placement created
 */
router.post("/", validate(createServicePlacementSchema), placementController.createServicePlacement);

/**
 * @openapi
 * /admin/service-placements:
 *   get:
 *     tags: [Admin: Service Placements]
 *     summary: List all placements (optional filter by page and/or section)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: string, enum: [home, blogs, articles, aayojan] }
 *       - in: query
 *         name: section
 *         schema: { type: string, enum: [sidebar, recommended, inline_ad, related] }
 *     responses:
 *       200:
 *         description: Placements list
 */
router.get("/", validate(listServicePlacementsAdminQuerySchema, "query"), placementController.listServicePlacementsAdmin);

/**
 * @openapi
 * /admin/service-placements/{id}:
 *   get:
 *     tags: [Admin: Service Placements]
 *     summary: Get a single placement with service details
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Placement found
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get("/:id", placementController.getServicePlacementAdmin);

/**
 * @openapi
 * /admin/service-placements/{id}:
 *   patch:
 *     tags: [Admin: Service Placements]
 *     summary: Update a placement (order, schedule, manual on/off via is_active)
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
 *               service_id: { type: string, format: uuid }
 *               page: { type: string, enum: [home, blogs, articles, aayojan] }
 *               section: { type: string, enum: [sidebar, recommended, inline_ad, related] }
 *               display_order: { type: integer, minimum: 0 }
 *               label: { type: string, nullable: true }
 *               cta_text: { type: string, nullable: true }
 *               starts_at: { type: string, format: date-time, nullable: true }
 *               ends_at: { type: string, format: date-time, nullable: true }
 *               is_active: { type: boolean }
 *     responses:
 *       200:
 *         description: Placement updated
 */
router.patch("/:id", validate(updateServicePlacementSchema), placementController.updateServicePlacement);

/**
 * @openapi
 * /admin/service-placements/{id}:
 *   delete:
 *     tags: [Admin: Service Placements]
 *     summary: Soft-delete a placement (manual off)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Placement soft-deleted
 */
router.delete("/:id", placementController.deleteServicePlacement);

/**
 * @openapi
 * /admin/service-placements/{id}/permanent:
 *   delete:
 *     tags: [Admin: Service Placements]
 *     summary: Permanently delete a placement
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Placement permanently deleted
 */
router.delete("/:id/permanent", placementController.deleteServicePlacementPermanently);

export default router;
