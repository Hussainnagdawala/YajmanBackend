import { Router } from "express";
import * as categoryController from "../controllers/category.controller";

const router = Router();

/**
 * @openapi
 * /categories:
 *   get:
 *     tags: [Categories]
 *     summary: List active categories (public storefront listing)
 *     responses:
 *       200:
 *         description: Active categories
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
 *                           requires_pandit: { type: boolean }
 *                           requires_payment: { type: boolean }
 */
router.get("/", categoryController.listCategories);

export default router;
