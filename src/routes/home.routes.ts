import { Router } from "express";
import * as homeController from "../controllers/home.controller";

const router = Router();

/**
 * @openapi
 * /home:
 *   get:
 *     tags: [Home]
 *     summary: Home screen aggregator — hero banners, popular searches, testimonials, bestsellers by category, categories, offer banner, recent blogs and stats in one call
 *     responses:
 *       200:
 *         description: Home screen data
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
 *                         banners:
 *                           type: array
 *                           items: { type: object }
 *                         popular_searches:
 *                           type: array
 *                           items: { type: object }
 *                         testimonials:
 *                           type: array
 *                           items: { type: object }
 *                         bestsellers:
 *                           type: object
 *                           description: Services grouped by category slug (underscored)
 *                         categories:
 *                           type: array
 *                           items: { type: object }
 *                         offer_banner:
 *                           type: object
 *                           nullable: true
 *                         recent_blogs:
 *                           type: array
 *                           items: { type: object }
 *                         stats:
 *                           type: object
 *                           properties:
 *                             pujas_completed: { type: integer }
 *                             connected_pandits: { type: integer }
 */
router.get("/", homeController.getHome);

export default router;
