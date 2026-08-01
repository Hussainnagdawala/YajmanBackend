import { Router, Request, Response, NextFunction } from "express";
import * as aayojanController from "../../controllers/aayojan.controller";
import { validate } from "../../middleware/validate";
import { uploadFields, uploadSingle } from "../../middleware/upload";
import {
  createAayojanContentSchema,
  updateAayojanContentSchema,
  createAayojanEventSchema,
  updateAayojanEventSchema,
  createAayojanBannerSchema,
  updateAayojanBannerSchema,
} from "../../validators/aayojan.schema";

const router = Router();

const setUploadFolder = (folder: string) => (req: Request, _res: Response, next: NextFunction) => {
  req.uploadFolder = folder;
  next();
};

// ─── Page content ────────────────────────────────────────────
const contentUploads = uploadFields([{ name: "image", maxCount: 1 }]);

/**
 * @openapi
 * /admin/aayojan/content:
 *   post:
 *     tags: [Admin: Aayojan]
 *     summary: Create an Aayojan page-content section
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [section_key]
 *             properties:
 *               image: { type: string, format: binary }
 *               section_key: { type: string, maxLength: 50 }
 *               title: { type: string, maxLength: 200 }
 *               subtitle: { type: string }
 *               description: { type: string }
 *               cta_text: { type: string, maxLength: 100 }
 *               cta_link: { type: string, maxLength: 500 }
 *               display_order: { type: integer, default: 0 }
 *     responses:
 *       201:
 *         description: Aayojan content created
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post(
  "/content",
  setUploadFolder("aayojan"),
  contentUploads,
  validate(createAayojanContentSchema),
  aayojanController.createAayojanContent
);

/**
 * @openapi
 * /admin/aayojan/content:
 *   get:
 *     tags: [Admin: Aayojan]
 *     summary: List all Aayojan page-content sections, including inactive ones
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Aayojan content list
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
router.get("/content", aayojanController.listAayojanContentAdmin);

/**
 * @openapi
 * /admin/aayojan/content/{id}:
 *   patch:
 *     tags: [Admin: Aayojan]
 *     summary: Update an Aayojan page-content section (partial update; optionally replaces the image)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image: { type: string, format: binary }
 *               section_key: { type: string, maxLength: 50 }
 *               title: { type: string, maxLength: 200 }
 *               subtitle: { type: string }
 *               description: { type: string }
 *               cta_text: { type: string, maxLength: 100 }
 *               cta_link: { type: string, maxLength: 500 }
 *               display_order: { type: integer }
 *               is_active: { type: boolean }
 *     responses:
 *       200:
 *         description: Aayojan content updated
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
router.patch(
  "/content/:id",
  setUploadFolder("aayojan"),
  contentUploads,
  validate(updateAayojanContentSchema),
  aayojanController.updateAayojanContent
);

/**
 * @openapi
 * /admin/aayojan/content/{id}:
 *   delete:
 *     tags: [Admin: Aayojan]
 *     summary: Soft-delete an Aayojan page-content section
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Aayojan content deleted
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
router.delete("/content/:id", aayojanController.deleteAayojanContent);

/**
 * @openapi
 * /admin/aayojan/content/{id}/permanent:
 *   delete:
 *     tags: [Admin: Aayojan]
 *     summary: Permanently delete an Aayojan page-content section and remove its image from storage
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Aayojan content permanently deleted
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
router.delete("/content/:id/permanent", aayojanController.deleteAayojanContentPermanently);

// ─── Events ──────────────────────────────────────────────────
const eventUploads = uploadFields([
  { name: "feature_image", maxCount: 1 },
  { name: "images", maxCount: 20 },
]);

/**
 * @openapi
 * /admin/aayojan/events:
 *   post:
 *     tags: [Admin: Aayojan]
 *     summary: Create an Aayojan event
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               feature_image: { type: string, format: binary }
 *               images:
 *                 type: array
 *                 items: { type: string, format: binary }
 *                 description: Up to 20 gallery images
 *               title: { type: string, maxLength: 200 }
 *               description: { type: string }
 *               short_description: { type: string }
 *               location: { type: string, maxLength: 200 }
 *               city: { type: string, maxLength: 100 }
 *               event_date: { type: string, pattern: '^\d{4}-\d{2}-\d{2}$', example: '2026-09-15' }
 *               event_time: { type: string, pattern: '^\d{2}:\d{2}$', example: '18:30' }
 *               price: { type: number, minimum: 0 }
 *               original_price: { type: number, minimum: 0 }
 *               max_capacity: { type: integer, minimum: 1 }
 *               status: { type: string, enum: [draft, published, archived], default: published }
 *     responses:
 *       201:
 *         description: Event created
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
 *                         status: { type: string, enum: [draft, published, archived] }
 *                         feature_image_url: { type: string, nullable: true }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post(
  "/events",
  setUploadFolder("aayojan"),
  eventUploads,
  validate(createAayojanEventSchema),
  aayojanController.createAayojanEvent
);

/**
 * @openapi
 * /admin/aayojan/events:
 *   get:
 *     tags: [Admin: Aayojan]
 *     summary: List all Aayojan events, including inactive ones
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Events list
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
router.get("/events", aayojanController.listAayojanEventsAdmin);

/**
 * @openapi
 * /admin/aayojan/events/{id}:
 *   patch:
 *     tags: [Admin: Aayojan]
 *     summary: Update an Aayojan event (partial update; optionally replaces feature image and appends gallery images)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               feature_image: { type: string, format: binary }
 *               images:
 *                 type: array
 *                 items: { type: string, format: binary }
 *                 description: Appended to the existing gallery, up to 20 per request
 *               title: { type: string, maxLength: 200 }
 *               description: { type: string }
 *               short_description: { type: string }
 *               location: { type: string, maxLength: 200 }
 *               city: { type: string, maxLength: 100 }
 *               event_date: { type: string, pattern: '^\d{4}-\d{2}-\d{2}$' }
 *               event_time: { type: string, pattern: '^\d{2}:\d{2}$' }
 *               price: { type: number, minimum: 0 }
 *               original_price: { type: number, minimum: 0 }
 *               max_capacity: { type: integer, minimum: 1 }
 *               status: { type: string, enum: [draft, published, archived] }
 *               is_active: { type: boolean }
 *     responses:
 *       200:
 *         description: Event updated
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
router.patch(
  "/events/:id",
  setUploadFolder("aayojan"),
  eventUploads,
  validate(updateAayojanEventSchema),
  aayojanController.updateAayojanEvent
);

/**
 * @openapi
 * /admin/aayojan/events/{id}:
 *   delete:
 *     tags: [Admin: Aayojan]
 *     summary: Soft-delete an Aayojan event
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Event deleted
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
router.delete("/events/:id", aayojanController.deleteAayojanEvent);

/**
 * @openapi
 * /admin/aayojan/events/{id}/permanent:
 *   delete:
 *     tags: [Admin: Aayojan]
 *     summary: Permanently delete an Aayojan event and its images (fails with 409 if any orders are still linked to it)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Event permanently deleted
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: Event still has linked orders
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.delete("/events/:id/permanent", aayojanController.deleteAayojanEventPermanently);

// ─── Banners ─────────────────────────────────────────────────

/**
 * @openapi
 * /admin/aayojan/banners:
 *   post:
 *     tags: [Admin: Aayojan]
 *     summary: Create an Aayojan banner
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [image]
 *             properties:
 *               image: { type: string, format: binary, description: Required — request is rejected with 400 if missing }
 *               title: { type: string, maxLength: 200 }
 *               link_url: { type: string, maxLength: 500 }
 *               display_order: { type: integer, default: 0 }
 *     responses:
 *       201:
 *         description: Aayojan banner created
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post(
  "/banners",
  setUploadFolder("aayojan"),
  uploadSingle("image"),
  validate(createAayojanBannerSchema),
  aayojanController.createAayojanBanner
);

/**
 * @openapi
 * /admin/aayojan/banners:
 *   get:
 *     tags: [Admin: Aayojan]
 *     summary: List all Aayojan banners, including inactive ones
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Aayojan banners list
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
router.get("/banners", aayojanController.listAayojanBannersAdmin);

/**
 * @openapi
 * /admin/aayojan/banners/{id}:
 *   patch:
 *     tags: [Admin: Aayojan]
 *     summary: Update an Aayojan banner (partial update; optionally replaces the image)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image: { type: string, format: binary }
 *               title: { type: string, maxLength: 200 }
 *               link_url: { type: string, maxLength: 500 }
 *               display_order: { type: integer }
 *               is_active: { type: boolean }
 *     responses:
 *       200:
 *         description: Aayojan banner updated
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
router.patch(
  "/banners/:id",
  setUploadFolder("aayojan"),
  uploadSingle("image"),
  validate(updateAayojanBannerSchema),
  aayojanController.updateAayojanBanner
);

/**
 * @openapi
 * /admin/aayojan/banners/{id}:
 *   delete:
 *     tags: [Admin: Aayojan]
 *     summary: Soft-delete an Aayojan banner
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Aayojan banner deleted
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
router.delete("/banners/:id", aayojanController.deleteAayojanBanner);

/**
 * @openapi
 * /admin/aayojan/banners/{id}/permanent:
 *   delete:
 *     tags: [Admin: Aayojan]
 *     summary: Permanently delete an Aayojan banner and remove its image from storage
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Aayojan banner permanently deleted
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
router.delete("/banners/:id/permanent", aayojanController.deleteAayojanBannerPermanently);

export default router;
