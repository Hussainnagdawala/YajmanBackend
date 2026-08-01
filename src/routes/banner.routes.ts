import { Router } from "express";
import * as homeController from "../controllers/home.controller";
import { validate } from "../middleware/validate";
import { listBannersQuerySchema } from "../validators/home.schema";

const router = Router();

// Public app API — same style as /categories, /types, /tags
// GET /banners?type=hero_slider|middle_ad|offer_banner|category_banner
/**
 * @openapi
 * /banners:
 *   get:
 *     tags: [Banners]
 *     summary: List active banners for a given position (either `type` or `position` must be provided — they're aliases)
 *     parameters:
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [hero_slider, middle_ad, offer_banner, category_banner] }
 *       - in: query
 *         name: position
 *         schema: { type: string, enum: [hero_slider, middle_ad, offer_banner, category_banner] }
 *         description: Alias for `type`
 *     responses:
 *       200:
 *         description: Active banners for the requested position
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
 *                           title: { type: string, nullable: true }
 *                           subtitle: { type: string, nullable: true }
 *                           image_url: { type: string }
 *                           mobile_image_url: { type: string, nullable: true }
 *                           link_url: { type: string, nullable: true }
 *                           position: { type: string, enum: [hero_slider, middle_ad, offer_banner, category_banner] }
 *                           display_order: { type: integer }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.get("/", validate(listBannersQuerySchema, "query"), homeController.listBanners);

export default router;
