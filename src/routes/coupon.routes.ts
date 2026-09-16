import { Router } from "express";
import * as couponController from "../controllers/coupon.controller";
import { validate } from "../middleware/validate";
import { validateCouponSchema } from "../validators/coupon.schema";

const router = Router();

/**
 * @openapi
 * /coupons:
 *   get:
 *     tags: [Coupons]
 *     summary: List active, currently-valid coupons
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Coupons fetched
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
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get("/", couponController.listCoupons);

/**
 * @openapi
 * /coupons/validate:
 *   post:
 *     tags: [Coupons]
 *     summary: Validate a coupon code for the current user against an order amount and compute the discount
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, amount]
 *             properties:
 *               code: { type: string }
 *               service_id: { type: string, format: uuid }
 *               amount: { type: number, exclusiveMinimum: 0 }
 *     responses:
 *       200:
 *         description: Coupon validation result
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post("/validate", validate(validateCouponSchema), couponController.validateCouponHandler);

export default router;
