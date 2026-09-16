import { Router } from "express";
import * as galleryController from "../controllers/gallery.controller";

const router = Router();

/**
 * @openapi
 * /gallery:
 *   get:
 *     tags: [Gallery]
 *     summary: List active website gallery images, ordered by display_order
 *     responses:
 *       200:
 *         description: Gallery images fetched
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
 *                           image_url: { type: string }
 *                           title: { type: string, nullable: true }
 *                           display_order: { type: integer }
 */
router.get("/", galleryController.listGalleryPublic);

export default router;
