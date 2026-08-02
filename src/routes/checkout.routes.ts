import { Router } from "express";
import * as checkoutController from "../controllers/checkout.controller";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createOrderSchema, verifyPaymentSchema } from "../validators/checkout.schema";

const router = Router();

/**
 * @openapi
 * /checkout/webhook:
 *   post:
 *     tags: [Checkout]
 *     summary: >
 *       Razorpay webhook receiver (payment.captured, payment.failed, refund.created,
 *       payment.dispute.created). No bearer auth — Razorpay calls this endpoint
 *       directly; the request is instead authenticated by verifying the
 *       X-Razorpay-Signature header against the raw request body.
 *     parameters:
 *       - in: header
 *         name: X-Razorpay-Signature
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Razorpay webhook event payload
 *             properties:
 *               event: { type: string, example: payment.captured }
 *               payload: { type: object }
 *     responses:
 *       200:
 *         description: Webhook processed (or acknowledged as a no-op for unhandled events)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *       400:
 *         description: Missing or invalid webhook signature
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 */
// No auth: called directly by Razorpay, verified via webhook signature instead.
router.post("/webhook", checkoutController.razorpayWebhook);

/**
 * @openapi
 * /checkout/create-order:
 *   post:
 *     tags: [Checkout]
 *     summary: Create an order + Razorpay order for a bookable (priced) service. Rejects services with no price — those are enquiry-only, use POST /services/{id}/inquiry instead.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [service_id, booking_date, booking_time, customer_name, customer_phone, members]
 *             properties:
 *               service_id: { type: string, format: uuid }
 *               booking_date: { type: string, pattern: '^\d{4}-\d{2}-\d{2}$', example: '2026-08-15' }
 *               booking_time: { type: string, pattern: '^\d{2}:\d{2}$', example: '10:30' }
 *               customer_name: { type: string, maxLength: 100 }
 *               customer_phone: { type: string, pattern: '^[6-9]\d{9}$', example: '9876543210' }
 *               customer_whatsapp: { type: string, pattern: '^[6-9]\d{9}$' }
 *               customer_calling_number: { type: string, pattern: '^[6-9]\d{9}$', nullable: true }
 *               customer_email: { type: string, format: email, maxLength: 150 }
 *               members:
 *                 type: array
 *                 minItems: 1
 *                 items: { type: string }
 *                 description: Names of family/group members included in the booking
 *               addon_ids:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *                 default: []
 *               gotra: { type: string, maxLength: 100 }
 *               gotra_unknown: { type: boolean, default: false }
 *               coupon_code: { type: string }
 *               address: { type: string }
 *               city: { type: string, maxLength: 100 }
 *               pincode: { type: string, maxLength: 10 }
 *               special_instructions: { type: string }
 *               birth_date: { type: string, pattern: '^\d{4}-\d{2}-\d{2}$', nullable: true }
 *               birth_time: { type: string, pattern: '^\d{2}:\d{2}$', nullable: true }
 *               birth_place: { type: string, maxLength: 150, nullable: true }
 *     responses:
 *       201:
 *         description: >
 *           Order created and a Razorpay order opened for it — use the returned razorpay
 *           details to launch Razorpay checkout, then call /checkout/verify-payment.
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
 *                         order:
 *                           type: object
 *                           properties:
 *                             id: { type: string, format: uuid }
 *                             order_number: { type: string }
 *                             total_amount: { type: number }
 *                             status: { type: string }
 *                         payment_required: { type: boolean, description: Always true — this endpoint only ever creates orders for priced services }
 *                         razorpay:
 *                           type: object
 *                           properties:
 *                             order_id: { type: string }
 *                             amount: { type: integer, description: Amount in paise }
 *                             currency: { type: string, example: INR }
 *                             key_id: { type: string }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post("/create-order", authenticate, validate(createOrderSchema), checkoutController.createOrder);

/**
 * @openapi
 * /checkout/verify-payment:
 *   post:
 *     tags: [Checkout]
 *     summary: Verify a Razorpay payment signature client-side and finalize/confirm the order
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [razorpay_order_id, razorpay_payment_id, razorpay_signature]
 *             properties:
 *               razorpay_order_id: { type: string }
 *               razorpay_payment_id: { type: string }
 *               razorpay_signature: { type: string }
 *     responses:
 *       200:
 *         description: Payment verified and order confirmed
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
 *                         order:
 *                           type: object
 *                           properties:
 *                             id: { type: string, format: uuid }
 *                             order_number: { type: string }
 *                             status: { type: string }
 *                         payment:
 *                           type: object
 *                           properties:
 *                             status: { type: string }
 *                             method: { type: string, nullable: true }
 *       400:
 *         description: Signature verification failed, or validation error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post("/verify-payment", authenticate, validate(verifyPaymentSchema), checkoutController.verifyPayment);

export default router;
