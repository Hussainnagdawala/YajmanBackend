import { Router, Request, Response, NextFunction } from "express";
import * as homeController from "../../controllers/home.controller";
import { validate } from "../../middleware/validate";
import { uploadSingle } from "../../middleware/upload";
import { createTestimonialSchema, updateTestimonialSchema } from "../../validators/home.schema";

const router = Router();

const setUploadFolder = (req: Request, _res: Response, next: NextFunction) => {
  req.uploadFolder = "testimonials";
  next();
};

/**
 * @openapi
 * /admin/testimonials:
 *   post:
 *     tags: [Admin: Testimonials]
 *     summary: Create a testimonial
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [author_name, quote]
 *             properties:
 *               avatar: { type: string, format: binary, description: Author avatar image }
 *               author_name: { type: string, maxLength: 100 }
 *               author_designation: { type: string, maxLength: 100 }
 *               quote: { type: string }
 *               rating: { type: integer, minimum: 1, maximum: 5 }
 *               page: { type: string, enum: [home, aayojan], default: home }
 *               display_order: { type: integer, default: 0 }
 *     responses:
 *       201:
 *         description: Testimonial created
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
 *                         author_name: { type: string }
 *                         author_designation: { type: string, nullable: true }
 *                         author_avatar_url: { type: string, nullable: true }
 *                         quote: { type: string }
 *                         rating: { type: integer, nullable: true }
 *                         page: { type: string, enum: [home, aayojan] }
 *                         display_order: { type: integer }
 *                         is_active: { type: boolean }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post("/", setUploadFolder, uploadSingle("avatar"), validate(createTestimonialSchema), homeController.createTestimonial);

/**
 * @openapi
 * /admin/testimonials:
 *   get:
 *     tags: [Admin: Testimonials]
 *     summary: List all testimonials, including inactive/soft-deleted ones
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Testimonials list
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
router.get("/", homeController.listTestimonialsAdmin);

/**
 * @openapi
 * /admin/testimonials/{id}:
 *   patch:
 *     tags: [Admin: Testimonials]
 *     summary: Update a testimonial (partial update; optionally replaces the avatar)
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
 *               avatar: { type: string, format: binary, description: Author avatar image }
 *               author_name: { type: string, maxLength: 100 }
 *               author_designation: { type: string, maxLength: 100 }
 *               quote: { type: string }
 *               rating: { type: integer, minimum: 1, maximum: 5 }
 *               page: { type: string, enum: [home, aayojan] }
 *               display_order: { type: integer }
 *               is_active: { type: boolean }
 *     responses:
 *       200:
 *         description: Testimonial updated
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
router.patch("/:id", setUploadFolder, uploadSingle("avatar"), validate(updateTestimonialSchema), homeController.updateTestimonial);

/**
 * @openapi
 * /admin/testimonials/{id}:
 *   delete:
 *     tags: [Admin: Testimonials]
 *     summary: Soft-delete a testimonial (marks it inactive)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Testimonial deleted
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
router.delete("/:id", homeController.deleteTestimonial);

/**
 * @openapi
 * /admin/testimonials/{id}/permanent:
 *   delete:
 *     tags: [Admin: Testimonials]
 *     summary: Permanently delete a testimonial and remove its avatar from storage
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Testimonial permanently deleted
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
router.delete("/:id/permanent", homeController.deleteTestimonialPermanently);

export default router;
