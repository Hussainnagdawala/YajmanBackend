import { Router } from "express";
import * as blogController from "../../controllers/blog.controller";
import { validate } from "../../middleware/validate";
import { createBlogAuthorSchema, updateBlogAuthorSchema } from "../../validators/blog.schema";

const router = Router();

router.post("/", validate(createBlogAuthorSchema), blogController.createBlogAuthor);
router.get("/", blogController.listBlogAuthorsAdmin);
router.patch("/:id", validate(updateBlogAuthorSchema), blogController.updateBlogAuthor);
router.delete("/:id", blogController.deleteBlogAuthor);

export default router;
