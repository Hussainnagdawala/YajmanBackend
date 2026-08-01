import { Router } from "express";
import * as invoiceController from "../../controllers/invoice.controller";
import { validate } from "../../middleware/validate";
import { listInvoicesQuerySchema } from "../../validators/booking.schema";

const router = Router();

/**
 * @openapi
 * /admin/invoices:
 *   get:
 *     tags: [Admin: Invoices]
 *     summary: List invoices, optionally filtered by creation date range
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: from
 *         schema: { type: string, pattern: '^\d{4}-\d{2}-\d{2}$' }
 *         description: Inclusive lower bound on invoice created_at (date)
 *       - in: query
 *         name: to
 *         schema: { type: string, pattern: '^\d{4}-\d{2}-\d{2}$' }
 *         description: Inclusive upper bound on invoice created_at (date)
 *     responses:
 *       200:
 *         description: Invoices fetched
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: array, items: { type: object } }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get("/", validate(listInvoicesQuerySchema, "query"), invoiceController.listInvoicesAdmin);

export default router;
