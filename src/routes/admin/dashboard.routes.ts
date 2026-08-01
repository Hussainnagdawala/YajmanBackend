import { Router } from "express";
import * as dashboardController from "../../controllers/admin/dashboard.controller";

const router = Router();

/**
 * @openapi
 * /admin/dashboard:
 *   get:
 *     tags: [Admin: Dashboard]
 *     summary: Get aggregate stats for the admin dashboard (orders, revenue, pandits, recent activity)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Dashboard stats
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
 *                         total_orders: { type: integer }
 *                         total_revenue: { type: number }
 *                         pending_orders: { type: integer }
 *                         active_pandits: { type: integer }
 *                         orders_today: { type: integer }
 *                         revenue_today: { type: number }
 *                         recent_orders: { type: array, items: { type: object } }
 *                         pending_assignments: { type: array, items: { type: object } }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get("/", dashboardController.getDashboard);

export default router;
