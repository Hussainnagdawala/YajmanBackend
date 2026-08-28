import { Router } from "express";
import * as placementController from "../controllers/service-placement.controller";
import { validate } from "../middleware/validate";
import { listServicePlacementsQuerySchema } from "../validators/service-placement.schema";

const router = Router();

/**
 * @openapi
 * /service-placements:
 *   get:
 *     tags: [Service Placements]
 *     summary: List active service placements for a page section (sidebar max 5)
 *     parameters:
 *       - in: query
 *         name: page
 *         required: true
 *         schema: { type: string, enum: [home, blogs, articles, aayojan] }
 *       - in: query
 *         name: section
 *         required: true
 *         schema: { type: string, enum: [sidebar, recommended, inline_ad, related] }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 20 }
 *         description: Capped by section limit (sidebar = 5)
 *     responses:
 *       200:
 *         description: Active placements (empty array if none configured)
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.get("/", validate(listServicePlacementsQuerySchema, "query"), placementController.listServicePlacementsPublic);

export default router;
