import { Router, Request, Response, NextFunction } from "express";
import * as serviceController from "../../controllers/service.controller";
import { validate } from "../../middleware/validate";
import { uploadFields, uploadArray } from "../../middleware/upload";
import {
  createServiceSchema,
  updateServiceSchema,
  listServicesAdminQuerySchema,
} from "../../validators/service.schema";

const router = Router();

const setUploadFolder = (req: Request, _res: Response, next: NextFunction) => {
  req.uploadFolder = "services";
  next();
};

const serviceUploads = uploadFields([
  { name: "feature_image", maxCount: 1 },
  { name: "images", maxCount: 20 },
]);

/**
 * @openapi
 * /admin/services:
 *   get:
 *     tags: [Admin: Services]
 *     summary: List services for the admin panel (filterable, paginated)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: page
 *         in: query
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - name: limit
 *         in: query
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *       - name: search
 *         in: query
 *         schema: { type: string }
 *         description: Matches against service title
 *       - name: category_id
 *         in: query
 *         schema: { type: string, format: uuid }
 *       - name: status
 *         in: query
 *         schema: { type: string, enum: [draft, published, archived] }
 *       - name: is_active
 *         in: query
 *         schema: { type: boolean }
 *       - name: sort
 *         in: query
 *         schema: { type: string, enum: [display_order, display_order_desc, price_asc, price_desc, newest, title] }
 *         description: Default is display_order (ascending). Use display_order_desc for reverse.
 *       - name: requires_pandit
 *         in: query
 *         schema: { type: boolean }
 *         description: Filter by the service's category flag (categories.requires_pandit)
 *       - name: requires_payment
 *         in: query
 *         schema: { type: boolean }
 *         description: Filter by the service's category flag (categories.requires_payment)
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
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get("/", validate(listServicesAdminQuerySchema, "query"), serviceController.listServicesAdmin);

/**
 * @openapi
 * /admin/services/{id}:
 *   get:
 *     tags: [Admin: Services]
 *     summary: Get a single service with full detail (relations, packages, faqs, images)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Service found
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
router.get("/:id", serviceController.getServiceAdmin);

/**
 * @openapi
 * /admin/services:
 *   post:
 *     tags: [Admin: Services]
 *     summary: Create a service (multipart; feature_image file is required). Array/object fields (type_ids, tag_ids, temple_ids, addon_ids, benefits, key_features, available_dates, packages, faqs) are sent as JSON-encoded strings in the form fields.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [title, category_id, feature_image, display_order]
 *             properties:
 *               title: { type: string, maxLength: 200 }
 *               category_id: { type: string, format: uuid }
 *               type_ids:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *                 default: []
 *               tag_ids:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *                 default: []
 *               temple_ids:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *                 default: []
 *               addon_ids:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *                 default: []
 *               is_addon_available: { type: boolean, default: false }
 *               benefits:
 *                 type: array
 *                 items: { type: string }
 *                 default: []
 *               price: { type: number, minimum: 0, description: 'Required if the category requires payment' }
 *               original_price: { type: number, exclusiveMinimum: 0 }
 *               short_description: { type: string }
 *               about_puja: { type: string }
 *               description: { type: string }
 *               custom_content: { type: string, description: 'HTML, sanitized server-side' }
 *               pincode: { type: string, maxLength: 10 }
 *               latitude: { type: number }
 *               longitude: { type: number }
 *               video_url: { type: string }
 *               duration_minutes: { type: integer, exclusiveMinimum: 0 }
 *               advance_booking_days: { type: integer, minimum: 0, default: 0 }
 *               availability_start_date: { type: string, pattern: '^\d{4}-\d{2}-\d{2}$', example: '2026-01-01' }
 *               availability_end_date: { type: string, pattern: '^\d{4}-\d{2}-\d{2}$', example: '2026-12-31' }
 *               booking_availability_type: { type: string, enum: [all_day, specific_day], default: all_day }
 *               available_dates:
 *                 type: array
 *                 items: { type: string, pattern: '^\d{4}-\d{2}-\d{2}$' }
 *                 default: []
 *               is_featured: { type: boolean, default: false }
 *               is_bestseller: { type: boolean, default: false }
 *               display_order: { type: integer, minimum: 0, description: 'Required. Must be unique across all services.' }
 *               meta_title: { type: string, maxLength: 200 }
 *               meta_description: { type: string }
 *               key_features:
 *                 type: array
 *                 items: { type: string }
 *                 default: []
 *               packages:
 *                 type: array
 *                 default: []
 *                 items:
 *                   type: object
 *                   required: [title]
 *                   properties:
 *                     title: { type: string, maxLength: 150 }
 *                     description: { type: string }
 *                     items:
 *                       type: array
 *                       default: []
 *                       items:
 *                         type: object
 *                         required: [name]
 *                         properties:
 *                           name: { type: string }
 *                           quantity: { type: string }
 *                           unit: { type: string }
 *                     price: { type: number, minimum: 0 }
 *               faqs:
 *                 type: array
 *                 default: []
 *                 items:
 *                   type: object
 *                   required: [question, answer]
 *                   properties:
 *                     question: { type: string }
 *                     answer: { type: string }
 *               feature_image: { type: string, format: binary }
 *               images:
 *                 type: array
 *                 items: { type: string, format: binary }
 *                 description: Up to 20 gallery images
 *     responses:
 *       201:
 *         description: Service created
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *       400:
 *         description: Validation error, missing feature_image, category not found, or price required by category
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
router.post("/", setUploadFolder, serviceUploads, validate(createServiceSchema), serviceController.createService);

/**
 * @openapi
 * /admin/services/{id}:
 *   patch:
 *     tags: [Admin: Services]
 *     summary: Update a service (multipart, all fields optional). Sending an array field (e.g. type_ids) replaces the full relation/list; omitting it leaves it unchanged.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string, maxLength: 200 }
 *               category_id: { type: string, format: uuid }
 *               type_ids:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *               tag_ids:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *               temple_ids:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *               addon_ids:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *               is_addon_available: { type: boolean }
 *               benefits:
 *                 type: array
 *                 items: { type: string }
 *               price: { type: number, minimum: 0 }
 *               original_price: { type: number, exclusiveMinimum: 0 }
 *               short_description: { type: string }
 *               about_puja: { type: string }
 *               description: { type: string }
 *               custom_content: { type: string, description: 'HTML, sanitized server-side' }
 *               pincode: { type: string, maxLength: 10 }
 *               latitude: { type: number }
 *               longitude: { type: number }
 *               video_url: { type: string }
 *               duration_minutes: { type: integer, exclusiveMinimum: 0 }
 *               advance_booking_days: { type: integer, minimum: 0 }
 *               availability_start_date: { type: string, pattern: '^\d{4}-\d{2}-\d{2}$' }
 *               availability_end_date: { type: string, pattern: '^\d{4}-\d{2}-\d{2}$' }
 *               booking_availability_type: { type: string, enum: [all_day, specific_day] }
 *               available_dates:
 *                 type: array
 *                 items: { type: string, pattern: '^\d{4}-\d{2}-\d{2}$' }
 *               is_featured: { type: boolean }
 *               is_bestseller: { type: boolean }
 *               is_active: { type: boolean }
 *               display_order: { type: integer }
 *               meta_title: { type: string, maxLength: 200 }
 *               meta_description: { type: string }
 *               key_features:
 *                 type: array
 *                 items: { type: string }
 *               packages:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [title]
 *                   properties:
 *                     title: { type: string, maxLength: 150 }
 *                     description: { type: string }
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 *                         required: [name]
 *                         properties:
 *                           name: { type: string }
 *                           quantity: { type: string }
 *                           unit: { type: string }
 *                     price: { type: number, minimum: 0 }
 *               faqs:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [question, answer]
 *                   properties:
 *                     question: { type: string }
 *                     answer: { type: string }
 *               feature_image: { type: string, format: binary }
 *               images:
 *                 type: array
 *                 items: { type: string, format: binary }
 *                 description: Appended to the existing gallery, not a replacement
 *     responses:
 *       200:
 *         description: Service updated
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *       400:
 *         description: Validation error, category not found, or price required by category
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
router.patch("/:id", setUploadFolder, serviceUploads, validate(updateServiceSchema), serviceController.updateService);

/**
 * @openapi
 * /admin/services/{id}:
 *   delete:
 *     tags: [Admin: Services]
 *     summary: Soft-delete a service
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Service deleted
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
router.delete("/:id", serviceController.deleteService);

/**
 * @openapi
 * /admin/services/{id}/permanent:
 *   delete:
 *     tags: [Admin: Services]
 *     summary: Permanently delete a service and its uploaded images (blocked if linked contact entries or orders exist)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Service permanently deleted
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: Service has linked contact entries or orders and cannot be deleted
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 */
router.delete("/:id/permanent", serviceController.deleteServicePermanently);

/**
 * @openapi
 * /admin/services/{id}/images:
 *   post:
 *     tags: [Admin: Services]
 *     summary: Add one or more gallery images to a service (appended after the current max display order)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [images]
 *             properties:
 *               images:
 *                 type: array
 *                 items: { type: string, format: binary }
 *                 description: Up to 20 image files
 *     responses:
 *       201:
 *         description: Images uploaded
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
 *         description: At least one image file is required
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
router.post("/:id/images", setUploadFolder, uploadArray("images", 20), serviceController.addServiceImages);

/**
 * @openapi
 * /admin/services/{id}/images/{imageId}:
 *   delete:
 *     tags: [Admin: Services]
 *     summary: Delete a single gallery image from a service (also removes it from S3)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - name: imageId
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Image deleted
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
router.delete("/:id/images/:imageId", serviceController.deleteServiceImage);

export default router;
