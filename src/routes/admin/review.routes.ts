import { Router } from "express";
import * as reviewController from "../../controllers/review.controller";
import { validate } from "../../middleware/validate";
import { moderateReviewSchema } from "../../validators/booking.schema";

const router = Router();

/**
 * @openapi
 * /admin/reviews/{id}:
 *   patch:
 *     tags: [Admin: Reviews]
 *     summary: Approve/reject a review and optionally attach an admin reply
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
 *               is_approved: { type: boolean }
 *               admin_reply: { type: string }
 *     responses:
 *       200:
 *         description: Review updated
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
router.patch("/:id", validate(moderateReviewSchema), reviewController.moderateReview);

/**
 * @openapi
 * /admin/reviews/{id}:
 *   delete:
 *     tags: [Admin: Reviews]
 *     summary: Delete a review and recalculate the service's rating
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Review deleted
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
router.delete("/:id", reviewController.deleteReviewAdmin);

export default router;
