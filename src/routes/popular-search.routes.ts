import { Router } from "express";
import * as homeController from "../controllers/home.controller";

const router = Router();

/**
 * @openapi
 * /popular-searches:
 *   get:
 *     tags: [Popular Searches]
 *     summary: List active popular search shortcuts (for a search-page/home quick-links widget)
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
 *                       items:
 *                         type: object
 *                         properties:
 *                           id: { type: string, format: uuid }
 *                           label: { type: string }
 *                           slug: { type: string, nullable: true }
 *                           link_url: { type: string, nullable: true }
 *                           display_order: { type: integer }
 *                           row_number: { type: integer, enum: [1, 2], description: Which of the two display rows this belongs to }
 *                           is_active: { type: boolean }
 */
router.get("/", homeController.listPopularSearchesPublic);

export default router;
