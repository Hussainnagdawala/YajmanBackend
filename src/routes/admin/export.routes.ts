import { Router } from "express";
import { validate } from "../../middleware/validate";
import { exportQuerySchema } from "../../validators/export.schema";
import { exportRateLimiter } from "../../middleware/rateLimiter";
import * as exportController from "../../controllers/admin/export.controller";

const router = Router();

/**
 * @openapi
 * /admin/export:
 *   get:
 *     summary: Export admin list data to Excel
 *     description: |
 *       Single export endpoint for all admin listings. Pass `resource` plus the same
 *       filter query params as the corresponding list API (status, search, from, to, etc.).
 *       Pagination params (page, limit) are ignored — all matching rows are exported.
 *     tags: [Admin Export]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: resource
 *         required: true
 *         schema:
 *           type: string
 *           enum: [orders, users, pandits, pandit-assignments, services, categories, coupons, contact-entries, invoices, aayojan-content, aayojan-events, aayojan-banners, aayojan-gallery]
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [xlsx]
 *           default: xlsx
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Excel file download
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema: { type: string, format: binary }
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       422:
 *         $ref: '#/components/responses/ValidationError'
 */
router.get("/", exportRateLimiter, validate(exportQuerySchema, "query"), exportController.exportAdminData);

export default router;
