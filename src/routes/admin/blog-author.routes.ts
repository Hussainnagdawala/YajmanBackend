import { Router, Request, Response, NextFunction } from "express";
import * as blogController from "../../controllers/blog.controller";
import { validate } from "../../middleware/validate";
import { uploadSingle } from "../../middleware/upload";
import { createBlogAuthorSchema, updateBlogAuthorSchema } from "../../validators/blog.schema";

const router = Router();

const setUploadFolder = (req: Request, _res: Response, next: NextFunction) => {
  req.uploadFolder = "blog-authors";
  next();
};

/**
 * @openapi
 * /admin/blog-authors:
 *   post:
 *     tags: [Admin: Blog Authors]
 *     summary: Create a blog author
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               avatar: { type: string, format: binary }
 *               name: { type: string, maxLength: 100 }
 *               bio: { type: string }
 *               user_id: { type: string, format: uuid, description: Links this author to an existing platform user account }
 *     responses:
 *       201:
 *         description: Blog author created
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
 *                         bio: { type: string, nullable: true }
 *                         avatar_url: { type: string, nullable: true }
 *                         user_id: { type: string, format: uuid, nullable: true }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post("/", setUploadFolder, uploadSingle("avatar"), validate(createBlogAuthorSchema), blogController.createBlogAuthor);

/**
 * @openapi
 * /admin/blog-authors:
 *   get:
 *     tags: [Admin: Blog Authors]
 *     summary: List all blog authors
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Blog authors list
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
router.get("/", blogController.listBlogAuthorsAdmin);

/**
 * @openapi
 * /admin/blog-authors/{id}:
 *   patch:
 *     tags: [Admin: Blog Authors]
 *     summary: Update a blog author (partial update; optionally replaces the avatar)
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
 *               avatar: { type: string, format: binary }
 *               name: { type: string, maxLength: 100 }
 *               bio: { type: string }
 *               user_id: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Blog author updated
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
router.patch("/:id", setUploadFolder, uploadSingle("avatar"), validate(updateBlogAuthorSchema), blogController.updateBlogAuthor);

/**
 * @openapi
 * /admin/blog-authors/{id}:
 *   delete:
 *     tags: [Admin: Blog Authors]
 *     summary: Delete a blog author
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Blog author deleted
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
router.delete("/:id", blogController.deleteBlogAuthor);

export default router;
