import { Router, Request, Response, NextFunction } from "express";
import * as bookingController from "../controllers/booking.controller";
import * as reviewController from "../controllers/review.controller";
import * as invoiceController from "../controllers/invoice.controller";
import { validate } from "../middleware/validate";
import { uploadArray } from "../middleware/upload";
import { listBookingsQuerySchema, cancelBookingSchema, submitReviewSchema } from "../validators/booking.schema";

const router = Router();

const setUploadFolder = (req: Request, _res: Response, next: NextFunction) => {
  req.uploadFolder = "reviews";
  next();
};

/**
 * @openapi
 * /bookings:
 *   get:
 *     tags: [Bookings]
 *     summary: List the current user's bookings (orders)
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
 *         name: status
 *         schema: { type: string, enum: [upcoming, completed, cancelled] }
 *     responses:
 *       200:
 *         description: Bookings fetched
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
 */
router.get("/", validate(listBookingsQuerySchema, "query"), bookingController.listBookings);

/**
 * @openapi
 * /bookings/{id}:
 *   get:
 *     tags: [Bookings]
 *     summary: Get a booking's (order's) full detail
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Booking detail fetched
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
router.get("/:id", bookingController.getBookingDetail);

/**
 * @openapi
 * /bookings/{id}/invoice:
 *   get:
 *     tags: [Bookings]
 *     summary: Get (generating on first request) the PDF invoice for a booking
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Existing invoice returned
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
 *                         invoice_number: { type: string }
 *                         pdf_url: { type: string }
 *       201:
 *         description: Invoice generated for the first time
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
 *                         invoice_number: { type: string }
 *                         pdf_url: { type: string }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get("/:id/invoice", invoiceController.getBookingInvoice);

/**
 * @openapi
 * /bookings/{id}/cancel:
 *   patch:
 *     tags: [Bookings]
 *     summary: Cancel a booking (refunds the payment automatically if one was captured)
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
 *             required: [reason]
 *             properties:
 *               reason: { type: string, minLength: 1, maxLength: 500 }
 *     responses:
 *       200:
 *         description: Booking cancelled (and refunded, if applicable)
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
router.patch("/:id/cancel", validate(cancelBookingSchema), bookingController.cancelBooking);

/**
 * @openapi
 * /bookings/{id}/review:
 *   post:
 *     tags: [Bookings]
 *     summary: Submit a review for a completed booking, with optional photos
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [rating]
 *             properties:
 *               rating: { type: integer, minimum: 1, maximum: 5 }
 *               title: { type: string, maxLength: 200 }
 *               comment: { type: string }
 *               photos:
 *                 type: array
 *                 maxItems: 5
 *                 items: { type: string, format: binary }
 *     responses:
 *       201:
 *         description: Review submitted
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
router.post(
  "/:id/review",
  setUploadFolder,
  uploadArray("photos", 5),
  validate(submitReviewSchema),
  reviewController.submitReviewViaBooking
);

export default router;
