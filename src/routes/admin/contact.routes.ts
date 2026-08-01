import { Router } from "express";
import * as contactController from "../../controllers/contact.controller";
import { validate } from "../../middleware/validate";
import { updateContactEntrySchema, listContactEntriesQuerySchema } from "../../validators/contact.schema";

const router = Router();

/**
 * @openapi
 * /admin/contact-entries:
 *   get:
 *     tags: [Admin: Contact Entries]
 *     summary: List contact form submissions (paginated, filterable by form type and status)
 *     security: [{ bearerAuth: [] }]
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
 *         name: form_type
 *         schema: { type: string, enum: [general, service, aayojan] }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [new, in_progress, resolved, closed] }
 *     responses:
 *       200:
 *         description: Contact entries list
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
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get("/", validate(listContactEntriesQuerySchema, "query"), contactController.listContactEntriesAdmin);

/**
 * @openapi
 * /admin/contact-entries/{id}:
 *   patch:
 *     tags: [Admin: Contact Entries]
 *     summary: Update a contact form entry (e.g. mark as read, change status, add admin notes, assign to a team member)
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
 *               is_read: { type: boolean }
 *               status: { type: string, enum: [new, in_progress, resolved, closed] }
 *               admin_notes: { type: string }
 *               assigned_to: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Contact entry updated
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.patch("/:id", validate(updateContactEntrySchema), contactController.updateContactEntryAdmin);

export default router;
