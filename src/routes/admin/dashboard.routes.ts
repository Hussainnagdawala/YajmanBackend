import { Router } from "express";
import * as dashboardController from "../../controllers/admin/dashboard.controller";
import { validate } from "../../middleware/validate";
import {
  dashboardTrendsQuerySchema,
  dashboardTopServicesQuerySchema,
  dashboardPanditPerformanceQuerySchema,
  dashboardTopCouponsQuerySchema,
} from "../../validators/dashboard.schema";

const router = Router();

/**
 * @openapi
 * /admin/dashboard:
 *   get:
 *     tags: [Admin: Dashboard]
 *     summary: Get aggregate stats for the admin dashboard (orders, revenue, users, pandits, recent activity, key rates)
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
 *                         active_services: { type: integer, description: is_active=true AND status='published' }
 *                         total_customers: { type: integer, description: role='customer' }
 *                         active_customers: { type: integer, description: logged in within the last 30 days }
 *                         new_customers_today: { type: integer }
 *                         new_customers_this_week: { type: integer }
 *                         new_customers_this_month: { type: integer }
 *                         avg_order_value: { type: number, description: Excludes pending/payment_failed orders }
 *                         cancellation_rate: { type: number, description: 0-1 fraction, cancelled+refunded+refund_failed over all non-pending orders }
 *                         refund_rate: { type: number, description: 0-1 fraction, refunded over (captured+refunded) payments }
 *                         repeat_customer_rate: { type: number, description: 0-1 fraction, customers with 2+ real orders }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get("/", dashboardController.getDashboard);

/**
 * @openapi
 * /admin/dashboard/trends:
 *   get:
 *     tags: [Admin: Dashboard]
 *     summary: Time-series trend for orders, revenue, new user signups, or service page views
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: metric
 *         required: true
 *         schema: { type: string, enum: [orders, revenue, users, views] }
 *       - in: query
 *         name: period
 *         schema: { type: string, enum: [daily, weekly, monthly], default: daily }
 *       - in: query
 *         name: from
 *         schema: { type: string, pattern: '^\d{4}-\d{2}-\d{2}$' }
 *         description: Defaults to 30 days back (daily), 84 days (weekly), or 365 days (monthly) before `to`
 *       - in: query
 *         name: to
 *         schema: { type: string, pattern: '^\d{4}-\d{2}-\d{2}$' }
 *         description: Defaults to today
 *     responses:
 *       200:
 *         description: Trend points fetched
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
 *                         metric: { type: string }
 *                         period: { type: string }
 *                         from: { type: string, format: date-time }
 *                         to: { type: string, format: date-time }
 *                         points:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               period_start: { type: string, format: date-time }
 *                               value: { type: number, description: Order count, revenue sum, new-user count, or view count depending on metric }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get("/trends", validate(dashboardTrendsQuerySchema, "query"), dashboardController.getTrends);

/**
 * @openapi
 * /admin/dashboard/services/top:
 *   get:
 *     tags: [Admin: Dashboard]
 *     summary: Leaderboard of services ranked by bookings, revenue, or page views
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: by
 *         schema: { type: string, enum: [bookings, revenue, views], default: bookings }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 50, default: 10 }
 *       - in: query
 *         name: from
 *         schema: { type: string, pattern: '^\d{4}-\d{2}-\d{2}$' }
 *         description: Defaults to all-time
 *       - in: query
 *         name: to
 *         schema: { type: string, pattern: '^\d{4}-\d{2}-\d{2}$' }
 *         description: Defaults to today
 *     responses:
 *       200:
 *         description: Top services fetched
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
 *                           title: { type: string }
 *                           slug: { type: string }
 *                           feature_image_url: { type: string, nullable: true }
 *                           category_name: { type: string }
 *                           bookings_count: { type: integer }
 *                           revenue: { type: number }
 *                           views_count: { type: integer }
 *                           unique_visitors: { type: integer }
 *                           traffic_share: { type: number, description: "This service's views ÷ total views across all services in the period, 0-1 fraction. Always returned regardless of `by` — only sort order changes." }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get("/services/top", validate(dashboardTopServicesQuerySchema, "query"), dashboardController.getTopServices);

/**
 * @openapi
 * /admin/dashboard/services/{id}/stats:
 *   get:
 *     tags: [Admin: Dashboard]
 *     summary: Performance/engagement stats for a single service (all-time)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Service stats fetched
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
 *                         id: { type: string, format: uuid }
 *                         title: { type: string }
 *                         slug: { type: string }
 *                         rating_avg: { type: number }
 *                         total_reviews: { type: integer }
 *                         total_bookings: { type: integer }
 *                         completed_bookings: { type: integer }
 *                         cancelled_bookings: { type: integer }
 *                         total_revenue: { type: number }
 *                         avg_order_value: { type: number }
 *                         total_views: { type: integer, description: All-time page views }
 *                         unique_visitors: { type: integer, description: Distinct IP+User-Agent fingerprints, all-time }
 *                         conversion_rate: { type: number, description: total_bookings ÷ total_views, 0-1 fraction }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get("/services/:id/stats", dashboardController.getServiceStats);

/**
 * @openapi
 * /admin/dashboard/pandits/performance:
 *   get:
 *     tags: [Admin: Dashboard]
 *     summary: Pandit performance leaderboard — acceptance rate, response time, completion count, rating
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 50, default: 10 }
 *     responses:
 *       200:
 *         description: Pandit performance fetched
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
 *                           display_name: { type: string }
 *                           phone: { type: string }
 *                           rating_avg: { type: number }
 *                           total_reviews: { type: integer }
 *                           total_assignments: { type: integer }
 *                           accepted_count: { type: integer }
 *                           rejected_count: { type: integer }
 *                           expired_count: { type: integer }
 *                           completed_count: { type: integer }
 *                           acceptance_rate: { type: number, nullable: true, description: 0-1 fraction }
 *                           avg_response_hours: { type: number, nullable: true, description: Average time from assigned to accepted }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get(
  "/pandits/performance",
  validate(dashboardPanditPerformanceQuerySchema, "query"),
  dashboardController.getPanditPerformance
);

/**
 * @openapi
 * /admin/dashboard/categories:
 *   get:
 *     tags: [Admin: Dashboard]
 *     summary: Category-wise breakdown — service count, bookings, revenue (all-time)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Category breakdown fetched
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
 *                           name: { type: string }
 *                           slug: { type: string }
 *                           requires_pandit: { type: boolean }
 *                           requires_payment: { type: boolean }
 *                           services_count: { type: integer }
 *                           bookings_count: { type: integer }
 *                           revenue: { type: number }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get("/categories", dashboardController.getCategoryBreakdown);

/**
 * @openapi
 * /admin/dashboard/coupons/top:
 *   get:
 *     tags: [Admin: Dashboard]
 *     summary: Top coupons by usage count, with total discount given (all-time)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 50, default: 10 }
 *     responses:
 *       200:
 *         description: Top coupons fetched
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
 *                           code: { type: string }
 *                           title: { type: string }
 *                           usage_count: { type: integer }
 *                           is_active: { type: boolean }
 *                           total_discount_given: { type: number }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get("/coupons/top", validate(dashboardTopCouponsQuerySchema, "query"), dashboardController.getTopCoupons);

export default router;
