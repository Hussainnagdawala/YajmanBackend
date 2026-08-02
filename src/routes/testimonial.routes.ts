import { Router } from "express";
import * as homeController from "../controllers/home.controller";
import { validate } from "../middleware/validate";
import { listTestimonialsQuerySchema } from "../validators/home.schema";

const router = Router();

/**
 * @openapi
 * /testimonials:
 *   get:
 *     tags: [Testimonials]
 *     summary: List active testimonials, optionally filtered by page
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: string, enum: [home, aayojan] }
 *         description: Omit to get testimonials for every page (ordered by page, then display_order)
 *     responses:
 *       200:
 *         description: Testimonials fetched
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
 *                           author_name: { type: string }
 *                           author_designation: { type: string, nullable: true }
 *                           author_avatar_url: { type: string, nullable: true }
 *                           quote: { type: string }
 *                           rating: { type: integer, nullable: true }
 *                           page: { type: string, enum: [home, aayojan] }
 *                           display_order: { type: integer }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.get("/", validate(listTestimonialsQuerySchema, "query"), homeController.listTestimonialsPublic);

export default router;
