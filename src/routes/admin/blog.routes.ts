import { Router, Request, Response, NextFunction } from "express";
import * as blogController from "../../controllers/blog.controller";
import { validate } from "../../middleware/validate";
import { uploadFields } from "../../middleware/upload";
import { createBlogSchema, updateBlogSchema } from "../../validators/blog.schema";

const router = Router();

const setUploadFolder = (req: Request, _res: Response, next: NextFunction) => {
  req.uploadFolder = "blogs";
  next();
};

const blogUploads = uploadFields([
  { name: "feature_image", maxCount: 1 },
  { name: "images", maxCount: 20 },
]);

/**
 * @openapi
 * /admin/blogs:
 *   post:
 *     tags: [Admin: Blogs]
 *     summary: Create a blog post
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [title, content]
 *             properties:
 *               feature_image: { type: string, format: binary }
 *               images:
 *                 type: array
 *                 items: { type: string, format: binary }
 *                 description: Up to 20 gallery images
 *               title: { type: string, maxLength: 300 }
 *               category_id: { type: string, format: uuid }
 *               author_id: { type: string, format: uuid }
 *               excerpt: { type: string }
 *               content: { type: string, description: HTML content, sanitized server-side }
 *               is_featured: { type: boolean, default: false }
 *               status: { type: string, enum: [draft, published, archived], default: draft }
 *               published_at: { type: string, format: date-time }
 *               recommended_blog_ids:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *                 default: []
 *                 description: Sent as a JSON-encoded string array in the multipart body
 *               meta_title: { type: string, maxLength: 200 }
 *               meta_description: { type: string }
 *     responses:
 *       201:
 *         description: Blog created
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
router.post("/", setUploadFolder, blogUploads, validate(createBlogSchema), blogController.createBlog);

/**
 * @openapi
 * /admin/blogs:
 *   get:
 *     tags: [Admin: Blogs]
 *     summary: List blogs (paginated, all statuses)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [draft, published, archived] }
 *       - in: query
 *         name: category_id
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Blogs list
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
router.get("/", blogController.listBlogsAdmin);

/**
 * @openapi
 * /admin/blogs/{id}:
 *   get:
 *     tags: [Admin: Blogs]
 *     summary: Get a single blog post by id (any status — drafts/archived included), for the edit screen
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Blog found
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
router.get("/:id", blogController.getBlogAdmin);

/**
 * @openapi
 * /admin/blogs/{id}:
 *   patch:
 *     tags: [Admin: Blogs]
 *     summary: Update a blog post (partial update; optionally replaces feature image and appends gallery images)
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
 *               title: { type: string, maxLength: 300 }
 *               category_id: { type: string, format: uuid }
 *               author_id: { type: string, format: uuid }
 *               excerpt: { type: string }
 *               content: { type: string }
 *               is_featured: { type: boolean }
 *               status: { type: string, enum: [draft, published, archived] }
 *               published_at: { type: string, format: date-time }
 *               recommended_blog_ids:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *                 description: Sent as a JSON-encoded string array; replaces the existing set
 *               meta_title: { type: string, maxLength: 200 }
 *               meta_description: { type: string }
 *     responses:
 *       200:
 *         description: Blog updated
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
router.patch("/:id", setUploadFolder, blogUploads, validate(updateBlogSchema), blogController.updateBlog);

/**
 * @openapi
 * /admin/blogs/{id}:
 *   delete:
 *     tags: [Admin: Blogs]
 *     summary: Soft-delete a blog post
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Blog deleted
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
router.delete("/:id", blogController.deleteBlog);

/**
 * @openapi
 * /admin/blogs/{id}/permanent:
 *   delete:
 *     tags: [Admin: Blogs]
 *     summary: Permanently delete a blog post and remove its feature/gallery images from storage
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Blog permanently deleted
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
router.delete("/:id/permanent", blogController.deleteBlogPermanently);

export default router;
