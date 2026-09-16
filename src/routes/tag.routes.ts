import { Router } from "express";
import * as tagController from "../controllers/tag.controller";

const router = Router();

/**
 * @openapi
 * /tags:
 *   get:
 *     tags: [Tags]
 *     summary: List active tags (public storefront listing)
 *     responses:
 *       200:
 *         description: Active tags
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
 *                           color: { type: string, nullable: true }
 *                           bg_color: { type: string, nullable: true }
 *                           display_order: { type: integer }
 */
router.get("/", tagController.listTags);

export default router;
