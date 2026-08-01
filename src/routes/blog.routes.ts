import { Router } from "express";
import * as blogController from "../controllers/blog.controller";
import { validate } from "../middleware/validate";
import { listBlogsQuerySchema } from "../validators/blog.schema";

const router = Router();

/**
 * @openapi
 * /blogs:
 *   get:
 *     tags: [Blogs]
 *     summary: List published blogs (public)
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *         description: Blog category id
 *       - in: query
 *         name: featured
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: Blogs fetched
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { type: object }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.get("/", validate(listBlogsQuerySchema, "query"), blogController.listBlogsPublic);

/**
 * @openapi
 * /blogs/{slug}:
 *   get:
 *     tags: [Blogs]
 *     summary: Get a published blog by slug
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Blog fetched
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get("/:slug", blogController.getBlogBySlug);

export default router;
