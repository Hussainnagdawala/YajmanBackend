import { Router } from "express";
import * as blogController from "../../controllers/blog.controller";
import { validate } from "../../middleware/validate";
import { createBlogCategorySchema, updateBlogCategorySchema } from "../../validators/blog.schema";

const router = Router();

/**
 * @openapi
 * /admin/blog-categories:
 *   post:
 *     tags: [Admin: Blog Categories]
 *     summary: Create a blog category
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, maxLength: 100 }
 *               description: { type: string }
 *               display_order: { type: integer, default: 0 }
 *     responses:
 *       201:
 *         description: Blog category created
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
 *                         name: { type: string }
 *                         slug: { type: string }
 *                         description: { type: string, nullable: true }
 *                         display_order: { type: integer }
 *                         is_active: { type: boolean }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post("/", validate(createBlogCategorySchema), blogController.createBlogCategory);

/**
 * @openapi
 * /admin/blog-categories:
 *   get:
 *     tags: [Admin: Blog Categories]
 *     summary: List all blog categories, including inactive ones
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Blog categories list
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
router.get("/", blogController.listBlogCategoriesAdmin);

/**
 * @openapi
 * /admin/blog-categories/{id}:
 *   patch:
 *     tags: [Admin: Blog Categories]
 *     summary: Update a blog category
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
 *               name: { type: string, maxLength: 100 }
 *               description: { type: string }
 *               display_order: { type: integer }
 *               is_active: { type: boolean }
 *     responses:
 *       200:
 *         description: Blog category updated
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
router.patch("/:id", validate(updateBlogCategorySchema), blogController.updateBlogCategory);

/**
 * @openapi
 * /admin/blog-categories/{id}:
 *   delete:
 *     tags: [Admin: Blog Categories]
 *     summary: Soft-delete a blog category
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Blog category deleted
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
router.delete("/:id", blogController.deleteBlogCategory);

/**
 * @openapi
 * /admin/blog-categories/{id}/permanent:
 *   delete:
 *     tags: [Admin: Blog Categories]
 *     summary: Permanently delete a blog category (fails with 409 if any blogs are still linked to it)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Blog category permanently deleted
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: Category still has linked blogs
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.delete("/:id/permanent", blogController.deleteBlogCategoryPermanently);

export default router;
