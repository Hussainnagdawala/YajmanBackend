import { Router, Request, Response, NextFunction } from "express";
import * as serviceController from "../controllers/service.controller";
import * as reviewController from "../controllers/review.controller";
import * as contactController from "../controllers/contact.controller";
import { authenticate, optionalAuthenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { uploadArray } from "../middleware/upload";
import { listServicesQuerySchema, listTrendingQuerySchema } from "../validators/service.schema";
import { submitServiceReviewSchema, listServiceReviewsQuerySchema } from "../validators/booking.schema";
import { createServiceInquirySchema } from "../validators/contact.schema";

const router = Router();

const setUploadFolder = (req: Request, _res: Response, next: NextFunction) => {
  req.uploadFolder = "reviews";
  next();
};

/**
 * @openapi
 * /services/bestsellers:
 *   get:
 *     tags: [Services]
 *     summary: List bestseller services grouped by category
 *     responses:
 *       200:
 *         description: Bestseller services grouped by category
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
 *                           category:
 *                             type: object
 *                             properties:
 *                               id: { type: string, format: uuid }
 *                               name: { type: string }
 *                               slug: { type: string }
 *                           services:
 *                             type: array
 *                             items: { type: object }
 */
router.get("/bestsellers", serviceController.getBestsellers);

/**
 * @openapi
 * /services/trending:
 *   get:
 *     tags: [Services]
 *     summary: List trending/featured services (flat, paginated)
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
 *     responses:
 *       200:
 *         description: Trending services
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
 */
router.get("/trending", validate(listTrendingQuerySchema, "query"), serviceController.getTrending);

/**
 * @openapi
 * /services/{id}/reviews:
 *   get:
 *     tags: [Services]
 *     summary: List approved reviews for a service (paginated)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *       - in: query
 *         name: sort
 *         schema: { type: string, enum: [newest, rating] }
 *     responses:
 *       200:
 *         description: Reviews fetched
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
 */
router.get("/:id/reviews", validate(listServiceReviewsQuerySchema, "query"), reviewController.listServiceReviews);

/**
 * @openapi
 * /services/{id}/reviews:
 *   post:
 *     tags: [Services]
 *     summary: Submit a review for a completed booking of this service (max 5 photos)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Service id
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [booking_id, rating]
 *             properties:
 *               booking_id: { type: string, format: uuid }
 *               rating: { type: integer, minimum: 1, maximum: 5 }
 *               title: { type: string, maxLength: 200 }
 *               comment: { type: string }
 *               photos:
 *                 type: array
 *                 items: { type: string, format: binary }
 *                 description: Up to 5 photo files
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
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post(
  "/:id/reviews",
  authenticate,
  setUploadFolder,
  uploadArray("photos", 5),
  validate(submitServiceReviewSchema),
  reviewController.submitReviewViaService
);

/**
 * @openapi
 * /services/{id}/inquiry:
 *   post:
 *     tags: [Services]
 *     summary: >
 *       Submit an inquiry for a service (no auth required) — the intended flow for
 *       services whose category has no price (requires_payment: false), which have
 *       no checkout flow at all. service_id, service_name, category_id and
 *       category_name are all resolved server-side from the :id in the URL, not
 *       accepted from the client.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Service id
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, phone]
 *             properties:
 *               name: { type: string, maxLength: 100 }
 *               email: { type: string, format: email, maxLength: 150 }
 *               phone: { type: string, pattern: '^[6-9]\d{9}$', example: '9876543210' }
 *               message: { type: string }
 *               birth_date: { type: string, pattern: '^\d{4}-\d{2}-\d{2}$', example: '1990-05-20' }
 *               birth_time: { type: string, pattern: '^\d{2}:\d{2}$', example: '09:30' }
 *               birth_place: { type: string, maxLength: 150 }
 *     responses:
 *       201:
 *         description: Inquiry submitted
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
 *                         form_type: { type: string, example: service }
 *                         name: { type: string }
 *                         email: { type: string, nullable: true }
 *                         phone: { type: string }
 *                         message: { type: string, nullable: true }
 *                         service_id: { type: string, format: uuid }
 *                         service_name: { type: string }
 *                         category_id: { type: string, format: uuid }
 *                         category_name: { type: string }
 *                         status: { type: string, example: new }
 *                         is_read: { type: boolean }
 *                         created_at: { type: string, format: date-time }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post("/:id/inquiry", validate(createServiceInquirySchema), contactController.createServiceInquiry);

/**
 * @openapi
 * /services/{slug}:
 *   get:
 *     tags: [Services]
 *     summary: >
 *       Get a published service's full detail by slug. Records a view event for
 *       analytics — bearer token optional (not required to view, but if a valid
 *       one is sent the view is attributed to that user; otherwise it's tracked
 *       anonymously via an IP+User-Agent fingerprint).
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Service found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get("/:slug", optionalAuthenticate, serviceController.getServiceBySlug);

/**
 * @openapi
 * /services:
 *   get:
 *     tags: [Services]
 *     summary: List published, active services (paginated, filterable) — public storefront listing
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
 *         name: category
 *         schema: { type: string }
 *         description: Category id (uuid) or slug
 *       - in: query
 *         name: type
 *         schema: { type: string }
 *         description: Comma-separated type ids or slugs
 *       - in: query
 *         name: tag
 *         schema: { type: string }
 *         description: Tag slug
 *       - in: query
 *         name: min_price
 *         schema: { type: number, minimum: 0 }
 *       - in: query
 *         name: max_price
 *         schema: { type: number, minimum: 0 }
 *       - in: query
 *         name: rating
 *         schema: { type: number, minimum: 0, maximum: 5 }
 *       - in: query
 *         name: sort
 *         schema: { type: string, enum: [display_order, display_order_desc, price_asc, price_desc, rating, newest, title] }
 *         description: Default is display_order (ascending). Website renders services in this order.
 *       - in: query
 *         name: is_featured
 *         schema: { type: boolean }
 *       - in: query
 *         name: is_bestseller
 *         schema: { type: boolean }
 *       - in: query
 *         name: requires_pandit
 *         schema: { type: boolean }
 *         description: Filter by the service's category flag (categories.requires_pandit)
 *       - in: query
 *         name: requires_payment
 *         schema: { type: boolean }
 *         description: Filter by the service's category flag — false means enquiry-only (no checkout), see POST /services/{id}/inquiry
 *     responses:
 *       200:
 *         description: Services fetched
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
 */
router.get("/", validate(listServicesQuerySchema, "query"), serviceController.listServicesPublic);

export default router;
