import { Router } from "express";
import * as orderController from "../../controllers/admin/order.controller";
import { validate } from "../../middleware/validate";
import {
  listOrdersAdminQuerySchema,
  updateOrderStatusAdminSchema,
  adminCancelOrderSchema,
} from "../../validators/order.schema";

const router = Router();

/**
 * @openapi
 * /admin/orders:
 *   get:
 *     tags: [Admin: Orders]
 *     summary: List orders with optional status/date-range/search filters
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
 *         description: Matches order_number, customer_name, or customer_phone
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, confirmed, pandit_assigned, in_progress, completed, cancelled, refunded, payment_failed, refund_failed, disputed, all]
 *       - in: query
 *         name: from
 *         schema: { type: string, pattern: '^\d{4}-\d{2}-\d{2}$' }
 *       - in: query
 *         name: to
 *         schema: { type: string, pattern: '^\d{4}-\d{2}-\d{2}$' }
 *     responses:
 *       200:
 *         description: Orders fetched
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
router.get("/", validate(listOrdersAdminQuerySchema, "query"), orderController.listOrdersAdmin);

/**
 * @openapi
 * /admin/orders/{id}:
 *   get:
 *     tags: [Admin: Orders]
 *     summary: Get full order detail — order row plus members, addons, payments, assignments, invoice, review, coupon
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Order detail fetched
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       description: Full orders row plus the joined fields below
 *                       properties:
 *                         service_title: { type: string }
 *                         service_slug: { type: string }
 *                         cancelled_by_name: { type: string, nullable: true }
 *                         members:
 *                           type: array
 *                           items: { type: string }
 *                           description: Order member names
 *                         addons:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               id: { type: string, format: uuid }
 *                               name: { type: string }
 *                               price: { type: number }
 *                         payments:
 *                           type: array
 *                           description: Every payment attempt, newest first
 *                           items:
 *                             type: object
 *                             properties:
 *                               id: { type: string, format: uuid }
 *                               razorpay_order_id: { type: string }
 *                               razorpay_payment_id: { type: string, nullable: true }
 *                               amount: { type: number }
 *                               currency: { type: string }
 *                               method: { type: string, nullable: true }
 *                               status: { type: string }
 *                               error_code: { type: string, nullable: true }
 *                               error_description: { type: string, nullable: true }
 *                               error_reason: { type: string, nullable: true }
 *                               paid_at: { type: string, format: date-time, nullable: true }
 *                               refunded_at: { type: string, format: date-time, nullable: true }
 *                               refund_amount: { type: number, nullable: true }
 *                               refund_id: { type: string, nullable: true }
 *                               created_at: { type: string, format: date-time }
 *                         assignments:
 *                           type: array
 *                           description: Full assignment history, newest first
 *                           items:
 *                             type: object
 *                             properties:
 *                               id: { type: string, format: uuid }
 *                               status: { type: string }
 *                               display_name: { type: string }
 *                               phone: { type: string }
 *                               assigned_at: { type: string, format: date-time }
 *                               respond_by: { type: string, format: date-time }
 *                               accepted_at: { type: string, format: date-time, nullable: true }
 *                               rejected_at: { type: string, format: date-time, nullable: true }
 *                               rejection_reason: { type: string, nullable: true }
 *                         invoice:
 *                           type: object
 *                           nullable: true
 *                           properties:
 *                             invoice_number: { type: string }
 *                             pdf_url: { type: string }
 *                         review:
 *                           type: object
 *                           nullable: true
 *                           properties:
 *                             id: { type: string, format: uuid }
 *                             rating: { type: integer }
 *                             title: { type: string, nullable: true }
 *                             comment: { type: string, nullable: true }
 *                         coupon:
 *                           type: object
 *                           nullable: true
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get("/:id", orderController.getOrderDetailAdmin);

/**
 * @openapi
 * /admin/orders/{id}/activity:
 *   get:
 *     tags: [Admin: Orders]
 *     summary: Get the activity/audit log for an order
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Activity log fetched
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
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get("/:id/activity", orderController.getOrderActivity);

/**
 * @openapi
 * /admin/orders/{id}/status:
 *   patch:
 *     tags: [Admin: Orders]
 *     summary: Move an order to a new status (generic transition; cancel/refund have dedicated endpoints)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, confirmed, pandit_assigned, in_progress, completed, payment_failed, disputed]
 *               notes: { type: string, maxLength: 1000 }
 *     responses:
 *       200:
 *         description: Order status updated
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
 *       409:
 *         description: The requested status transition is not allowed from the order's current status
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 */
router.patch("/:id/status", validate(updateOrderStatusAdminSchema), orderController.updateOrderStatusAdmin);

/**
 * @openapi
 * /admin/orders/{id}/cancel:
 *   patch:
 *     tags: [Admin: Orders]
 *     summary: Cancel an order and attempt a Razorpay refund if a captured payment exists (bypasses the 24h customer cancel window)
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
 *               reason: { type: string, maxLength: 500 }
 *     responses:
 *       200:
 *         description: Order cancelled
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
 *                         refund_outcome: { type: string, enum: [not_applicable, success, failed] }
 *       400:
 *         description: Validation error, or the order's current status is not cancellable
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.patch("/:id/cancel", validate(adminCancelOrderSchema), orderController.cancelOrderAdmin);

/**
 * @openapi
 * /admin/orders/{id}/retry-refund:
 *   post:
 *     tags: [Admin: Orders]
 *     summary: Manually retry a failed Razorpay refund for an order in refund_failed status
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Refund processed
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *       400:
 *         description: Order is not in refund_failed status, or no captured payment was found to refund
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       502:
 *         description: Refund retry failed at the payment gateway — check the Razorpay dashboard
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 */
router.post("/:id/retry-refund", orderController.retryRefund);

export default router;
