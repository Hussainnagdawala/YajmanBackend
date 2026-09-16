import { Router, Request, Response, NextFunction } from "express";
import * as homeController from "../../controllers/home.controller";
import { validate } from "../../middleware/validate";
import { uploadFields } from "../../middleware/upload";
import {
  createBannerSchema,
  updateBannerSchema,
} from "../../validators/home.schema";

const router = Router();

const setUploadFolder = (req: Request, _res: Response, next: NextFunction) => {
  req.uploadFolder = "banners";
  next();
};

const bannerUploads = uploadFields([
  { name: "image", maxCount: 1 },
  { name: "mobile_image", maxCount: 1 },
]);

/**
 * @openapi
 * /admin/banners:
 *   post:
 *     tags: [Admin: Banners]
 *     summary: Create a banner (multipart; the `image` file is required)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [position, image]
 *             properties:
 *               title: { type: string, maxLength: 200 }
 *               subtitle: { type: string }
 *               description: { type: string }
 *               link_url: { type: string, maxLength: 500 }
 *               cta_text: { type: string, maxLength: 50 }
 *               position:
 *                 type: string
 *                 enum: [hero_slider, middle_ad, offer_banner, category_banner]
 *               discount_text: { type: string, maxLength: 50 }
 *               bg_color: { type: string, pattern: '^#[0-9a-fA-F]{6}$' }
 *               text_color: { type: string, pattern: '^#[0-9a-fA-F]{6}$' }
 *               display_order: { type: integer, default: 0 }
 *               starts_at: { type: string, format: date-time }
 *               ends_at: { type: string, format: date-time }
 *               image: { type: string, format: binary }
 *               mobile_image: { type: string, format: binary }
 *     responses:
 *       201:
 *         description: Banner created
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
  "/",
  setUploadFolder,
  bannerUploads,
  validate(createBannerSchema),
  homeController.createBanner,
);

/**
 * @openapi
 * /admin/banners:
 *   get:
 *     tags: [Admin: Banners]
 *     summary: List all banners (including inactive)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Banners fetched
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
router.get("/", homeController.listBannersAdmin);

/**
 * @openapi
 * /admin/banners/{id}:
 *   patch:
 *     tags: [Admin: Banners]
 *     summary: Update a banner (multipart, optional image/mobile_image replacement)
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
 *               subtitle: { type: string }
 *               description: { type: string }
 *               link_url: { type: string, maxLength: 500 }
 *               cta_text: { type: string, maxLength: 50 }
 *               position:
 *                 type: string
 *                 enum: [hero_slider, middle_ad, offer_banner, category_banner]
 *               discount_text: { type: string, maxLength: 50 }
 *               bg_color: { type: string, pattern: '^#[0-9a-fA-F]{6}$' }
 *               text_color: { type: string, pattern: '^#[0-9a-fA-F]{6}$' }
 *               display_order: { type: integer }
 *               starts_at: { type: string, format: date-time }
 *               ends_at: { type: string, format: date-time }
 *               is_active: { type: boolean }
 *               image: { type: string, format: binary }
 *               mobile_image: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Banner updated
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *       400:
 *         description: Validation error, or no fields provided to update
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
router.patch(
  "/:id",
  setUploadFolder,
  bannerUploads,
  validate(updateBannerSchema),
  homeController.updateBanner,
);

/**
 * @openapi
 * /admin/banners/{id}:
 *   delete:
 *     tags: [Admin: Banners]
 *     summary: Soft-delete a banner
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Banner deleted
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
router.delete("/:id", homeController.deleteBanner);

/**
 * @openapi
 * /admin/banners/{id}/permanent:
 *   delete:
 *     tags: [Admin: Banners]
 *     summary: Permanently delete a banner and its uploaded image(s)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Banner permanently deleted
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
router.delete("/:id/permanent", homeController.deleteBannerPermanently);

export default router;
