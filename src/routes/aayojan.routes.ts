import { Router } from "express";
import * as aayojanController from "../controllers/aayojan.controller";
import * as contactController from "../controllers/contact.controller";
import { validate } from "../middleware/validate";
import { createAayojanContactSchema } from "../validators/contact.schema";

const router = Router();

/**
 * @openapi
 * /aayojan:
 *   get:
 *     tags: [Aayojan]
 *     summary: Get the Aayojan page aggregator (content sections, events, banners, testimonials)
 *     responses:
 *       200:
 *         description: Aayojan page data fetched
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
 *                         content: { type: array, items: { type: object } }
 *                         events: { type: array, items: { type: object } }
 *                         banners: { type: array, items: { type: object } }
 *                         testimonials: { type: array, items: { type: object } }
 */
router.get("/", aayojanController.getAayojan);

/**
 * @openapi
 * /aayojan/events/{slug}:
 *   get:
 *     tags: [Aayojan]
 *     summary: Get an Aayojan event by slug
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Event fetched
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get("/events/:slug", aayojanController.getAayojanEventBySlug);

/**
 * @openapi
 * /aayojan/contact:
 *   post:
 *     tags: [Aayojan]
 *     summary: Submit an Aayojan event inquiry/contact form
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, phone]
 *             properties:
 *               name: { type: string, maxLength: 100 }
 *               email: { type: string, format: email, maxLength: 150 }
 *               phone: { type: string, pattern: '^[6-9]\d{9}$', example: '9876543210' }
 *               city: { type: string, maxLength: 100 }
 *               event_name: { type: string, maxLength: 200 }
 *               number_of_people: { type: integer, minimum: 1 }
 *               preferred_date: { type: string, pattern: '^\d{4}-\d{2}-\d{2}$', example: '2026-08-15' }
 *     responses:
 *       201:
 *         description: Contact inquiry submitted
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.post("/contact", validate(createAayojanContactSchema), contactController.createAayojanContact);

export default router;
