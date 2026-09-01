import { Router, Request, Response, NextFunction } from "express";
import * as galleryController from "../../controllers/gallery.controller";
import { validate } from "../../middleware/validate";
import { uploadArray } from "../../middleware/upload";
import { updateGalleryImageSchema } from "../../validators/gallery.schema";

const router = Router();

const setUploadFolder = (req: Request, _res: Response, next: NextFunction) => {
  req.uploadFolder = "gallery";
  next();
};

/**
 * @openapi
 * /admin/gallery:
 *   post:
 *     tags: [Admin: Gallery]
 *     summary: Bulk-upload images to the website gallery (images only, up to 20 per request)
 *     security: [{ bearerAuth: [] }]
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
 *                 description: Up to 20 image files in one request. Rejected with 400 if none are sent.
 *     responses:
 *       201:
 *         description: Gallery images uploaded
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
 *                           id: { type: string, format: uuid }
 *                           image_url: { type: string }
 *                           title: { type: string, nullable: true }
 *                           display_order: { type: integer }
 *                           is_active: { type: boolean }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post("/", setUploadFolder, uploadArray("images", 20), galleryController.createGalleryImages);

/**
 * @openapi
 * /admin/gallery:
 *   get:
 *     tags: [Admin: Gallery]
 *     summary: List all gallery images, including inactive ones
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Gallery images list
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
router.get("/", galleryController.listGalleryAdmin);

/**
 * @openapi
 * /admin/gallery/{id}:
 *   patch:
 *     tags: [Admin: Gallery]
 *     summary: >
 *       Update a gallery image — the is_active toggle is how visibility on the website
 *       is managed (reversible, unlike delete). title and display_order can also be
 *       changed in the same call; send any subset.
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
 *               title: { type: string, maxLength: 200 }
 *               display_order: { type: integer }
 *               is_active: { type: boolean }
 *     responses:
 *       200:
 *         description: Gallery image updated
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
router.patch("/:id", validate(updateGalleryImageSchema), galleryController.updateGalleryImage);

/**
 * @openapi
 * /admin/gallery/{id}:
 *   delete:
 *     tags: [Admin: Gallery]
 *     summary: "Soft-delete a gallery image (same effect as PATCH { is_active: false })"
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Gallery image deleted
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
router.delete("/:id", galleryController.deleteGalleryImage);

/**
 * @openapi
 * /admin/gallery/{id}/permanent:
 *   delete:
 *     tags: [Admin: Gallery]
 *     summary: Permanently delete a gallery image and remove it from storage
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Gallery image permanently deleted
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
router.delete("/:id/permanent", galleryController.deleteGalleryImagePermanently);

export default router;
