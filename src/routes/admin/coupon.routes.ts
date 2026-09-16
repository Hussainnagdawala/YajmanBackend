import { Router } from "express";
import * as couponController from "../../controllers/coupon.controller";
import { validate } from "../../middleware/validate";
import { createCouponSchema, updateCouponSchema } from "../../validators/coupon.schema";

const router = Router();

/**
 * @openapi
 * /admin/coupons:
 *   post:
 *     tags: [Admin: Coupons]
 *     summary: Create a coupon
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, title, discount_type, discount_value, valid_from, valid_until]
 *             properties:
 *               code: { type: string, minLength: 3, maxLength: 30, description: Stored uppercased }
 *               title: { type: string, maxLength: 150 }
 *               description: { type: string }
 *               discount_type: { type: string, enum: [percentage, fixed] }
 *               discount_value: { type: number, exclusiveMinimum: 0 }
 *               max_discount_amount: { type: number, exclusiveMinimum: 0 }
 *               min_order_amount: { type: number, minimum: 0, default: 0 }
 *               usage_limit: { type: integer, minimum: 1 }
 *               per_user_limit: { type: integer, minimum: 1, default: 1 }
 *               valid_from: { type: string, format: date-time }
 *               valid_until: { type: string, format: date-time, description: Must be after valid_from }
 *               applicable_categories:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *               applicable_services:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Coupon created
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
 *                         code: { type: string }
 *                         title: { type: string }
 *                         discount_type: { type: string, enum: [percentage, fixed] }
 *                         discount_value: { type: number }
 *                         is_active: { type: boolean }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post("/", validate(createCouponSchema), couponController.createCoupon);

/**
 * @openapi
 * /admin/coupons:
 *   get:
 *     tags: [Admin: Coupons]
 *     summary: List all coupons, including inactive/expired ones
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Coupons list
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
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get("/", couponController.listCouponsAdmin);

/**
 * @openapi
 * /admin/coupons/{id}:
 *   patch:
 *     tags: [Admin: Coupons]
 *     summary: Update a coupon
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
 *               code: { type: string, minLength: 3, maxLength: 30 }
 *               title: { type: string, maxLength: 150 }
 *               description: { type: string }
 *               discount_type: { type: string, enum: [percentage, fixed] }
 *               discount_value: { type: number, exclusiveMinimum: 0 }
 *               max_discount_amount: { type: number, exclusiveMinimum: 0 }
 *               min_order_amount: { type: number, minimum: 0 }
 *               usage_limit: { type: integer, minimum: 1 }
 *               per_user_limit: { type: integer, minimum: 1 }
 *               valid_from: { type: string, format: date-time }
 *               valid_until: { type: string, format: date-time }
 *               applicable_categories:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *               applicable_services:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *               is_active: { type: boolean }
 *     responses:
 *       200:
 *         description: Coupon updated
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
router.patch("/:id", validate(updateCouponSchema), couponController.updateCoupon);

/**
 * @openapi
 * /admin/coupons/{id}:
 *   delete:
 *     tags: [Admin: Coupons]
 *     summary: Soft-delete a coupon
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Coupon deleted
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.delete("/:id", couponController.deleteCoupon);

/**
 * @openapi
 * /admin/coupons/{id}/permanent:
 *   delete:
 *     tags: [Admin: Coupons]
 *     summary: Permanently delete a coupon (fails with 409 if it has usage history or linked orders)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Coupon permanently deleted
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: Coupon still has linked usage or orders
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.delete("/:id/permanent", couponController.deleteCouponPermanently);

export default router;
