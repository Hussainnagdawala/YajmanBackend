import { Router } from "express";
import * as legalController from "../controllers/legal.controller";

const router = Router();

/**
 * @openapi
 * /legal:
 *   get:
 *     tags: [Legal]
 *     summary: List active legal pages (Terms, Privacy, Cookies, Disclaimer, Return Policy)
 *     responses:
 *       200:
 *         description: Legal pages fetched
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
 *                           slug: { type: string }
 *                           title: { type: string }
 *                           meta_title: { type: string, nullable: true }
 *                           meta_description: { type: string, nullable: true }
 *                           updated_at: { type: string, format: date-time }
 */
router.get("/", legalController.listLegalPages);

/**
 * @openapi
 * /legal/{slug}:
 *   get:
 *     tags: [Legal]
 *     summary: Get a single legal page by slug (e.g. terms-and-conditions, privacy-policy, cookies-policy, disclaimer, return-policy)
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Legal page fetched
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get("/:slug", legalController.getLegalPage);

export default router;
