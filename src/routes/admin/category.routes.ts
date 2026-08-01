import { Router, Request, Response, NextFunction } from "express";
import * as categoryController from "../../controllers/category.controller";
import { validate } from "../../middleware/validate";
import { uploadFields } from "../../middleware/upload";
import { createCategorySchema, updateCategorySchema } from "../../validators/category.schema";

const router = Router();

const setUploadFolder = (req: Request, _res: Response, next: NextFunction) => {
  req.uploadFolder = "categories";
  next();
};

const categoryUploads = uploadFields([
  { name: "image", maxCount: 1 },
  { name: "icon", maxCount: 1 },
]);

/**
 * @openapi
 * /admin/categories:
 *   post:
 *     tags: [Admin: Categories]
 *     summary: Create a category (multipart, optional image/icon upload)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, maxLength: 100 }
 *               description: { type: string }
 *               type_ids:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *                 description: Type IDs to link (may also be sent as a single uuid string form field)
 *               display_order: { type: integer, default: 0 }
 *               meta_title: { type: string, maxLength: 200 }
 *               meta_description: { type: string }
 *               requires_pandit: { type: boolean, default: true }
 *               requires_payment: { type: boolean, default: true }
 *               image: { type: string, format: binary }
 *               icon: { type: string, format: binary }
 *     responses:
 *       201:
 *         description: Category created
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
router.post("/", setUploadFolder, categoryUploads, validate(createCategorySchema), categoryController.createCategory);

/**
 * @openapi
 * /admin/categories:
 *   get:
 *     tags: [Admin: Categories]
 *     summary: List all categories (including inactive/soft-deleted)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Categories fetched
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
router.get("/", categoryController.listCategoriesAdmin);

/**
 * @openapi
 * /admin/categories/{id}:
 *   get:
 *     tags: [Admin: Categories]
 *     summary: Get a single category by ID
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Category found
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
router.get("/:id", categoryController.getCategory);

/**
 * @openapi
 * /admin/categories/{id}:
 *   patch:
 *     tags: [Admin: Categories]
 *     summary: Update a category (multipart, optional image/icon replacement)
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
 *               name: { type: string, maxLength: 100 }
 *               description: { type: string }
 *               type_ids:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *                 description: Replaces the full set of linked type IDs when sent
 *               display_order: { type: integer }
 *               meta_title: { type: string, maxLength: 200 }
 *               meta_description: { type: string }
 *               requires_pandit: { type: boolean }
 *               requires_payment: { type: boolean }
 *               is_active: { type: boolean }
 *               image: { type: string, format: binary }
 *               icon: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Category updated
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
router.patch("/:id", setUploadFolder, categoryUploads, validate(updateCategorySchema), categoryController.updateCategory);

/**
 * @openapi
 * /admin/categories/{id}:
 *   delete:
 *     tags: [Admin: Categories]
 *     summary: Soft-delete a category (blocked if services are still linked to it)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Category deleted
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
 *         description: Category has linked services and cannot be deleted
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 */
router.delete("/:id", categoryController.deleteCategory);

/**
 * @openapi
 * /admin/categories/{id}/permanent:
 *   delete:
 *     tags: [Admin: Categories]
 *     summary: Permanently delete a category and its uploaded image/icon (blocked if services are still linked to it)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Category permanently deleted
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
 *         description: Category has linked services and cannot be deleted
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 */
router.delete("/:id/permanent", categoryController.deleteCategoryPermanently);

export default router;
