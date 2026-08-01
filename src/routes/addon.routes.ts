import { Router } from "express";
import * as addonController from "../controllers/addon.controller";

const router = Router();

/**
 * @openapi
 * /addons:
 *   get:
 *     tags: [Addons]
 *     summary: List active addons (public storefront listing)
 *     responses:
 *       200:
 *         description: Active addons
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
 *                           image_url: { type: string, nullable: true }
 *                           price: { type: number }
 *                           is_free: { type: boolean }
 *                           display_order: { type: integer }
 */
router.get("/", addonController.listAddons);

export default router;
