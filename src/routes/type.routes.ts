import { Router } from "express";
import * as typeController from "../controllers/type.controller";

const router = Router();

/**
 * @openapi
 * /types:
 *   get:
 *     tags: [Types]
 *     summary: List active types (public storefront listing)
 *     responses:
 *       200:
 *         description: Active types
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id: { type: string, format: uuid }
 *                           name: { type: string }
 *                           slug: { type: string }
 *                           description: { type: string, nullable: true }
 *                           image_url: { type: string, nullable: true }
 *                           icon_url: { type: string, nullable: true }
 *                           display_order: { type: integer }
 */
router.get("/", typeController.listTypes);

export default router;
