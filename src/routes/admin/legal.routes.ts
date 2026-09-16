import { Router } from "express";
import * as legalController from "../../controllers/legal.controller";
import { validate } from "../../middleware/validate";
import { createLegalPageSchema, updateLegalPageSchema } from "../../validators/legal.schema";

const router = Router();

/**
 * @openapi
 * /admin/legal-pages:
 *   post:
 *     tags: [Admin: Legal Pages]
 *     summary: Create a new legal page
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title: { type: string, maxLength: 200 }
 *               content: { type: string, description: 'Rich-text HTML from the admin editor (sanitized server-side)' }
 *               meta_title: { type: string, maxLength: 200, nullable: true }
 *               meta_description: { type: string, nullable: true }
 *               is_active: { type: boolean, default: true }
 *     responses:
 *       201:
 *         description: Legal page created
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post("/", validate(createLegalPageSchema), legalController.createLegalPageAdmin);

/**
 * @openapi
 * /admin/legal-pages:
 *   get:
 *     tags: [Admin: Legal Pages]
 *     summary: List all legal pages (Terms, Privacy, Cookies, Disclaimer, Return Policy)
 *     security: [{ bearerAuth: [] }]
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
 *                     data: { type: array, items: { type: object } }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get("/", legalController.listLegalPagesAdmin);

/**
 * @openapi
 * /admin/legal-pages/{id}:
 *   get:
 *     tags: [Admin: Legal Pages]
 *     summary: Get a single legal page by id
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Legal page fetched
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get("/:id", legalController.getLegalPageAdmin);

/**
 * @openapi
 * /admin/legal-pages/{id}:
 *   patch:
 *     tags: [Admin: Legal Pages]
 *     summary: Update a legal page's title, HTML content, meta fields or visibility
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string, maxLength: 200 }
 *               content: { type: string, description: 'Rich-text HTML from the admin editor (sanitized server-side)' }
 *               meta_title: { type: string, maxLength: 200, nullable: true }
 *               meta_description: { type: string, nullable: true }
 *               is_active: { type: boolean, description: 'Whether the page is visible on the public site' }
 *     responses:
 *       200:
 *         description: Legal page updated
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.patch("/:id", validate(updateLegalPageSchema), legalController.updateLegalPageAdmin);

/**
 * @openapi
 * /admin/legal-pages/{id}:
 *   delete:
 *     tags: [Admin: Legal Pages]
 *     summary: Soft-delete a legal page (sets is_active false)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Legal page deleted
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete("/:id", legalController.deleteLegalPageAdmin);

/**
 * @openapi
 * /admin/legal-pages/{id}/permanent:
 *   delete:
 *     tags: [Admin: Legal Pages]
 *     summary: Permanently delete a legal page
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Legal page permanently deleted
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete("/:id/permanent", legalController.deleteLegalPagePermanently);

export default router;
