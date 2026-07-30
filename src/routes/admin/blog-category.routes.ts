import { Router } from "express";
import * as blogController from "../../controllers/blog.controller";
import { validate } from "../../middleware/validate";
import { createBlogCategorySchema, updateBlogCategorySchema } from "../../validators/blog.schema";

const router = Router();

router.post("/", validate(createBlogCategorySchema), blogController.createBlogCategory);
router.get("/", blogController.listBlogCategoriesAdmin);
router.patch("/:id", validate(updateBlogCategorySchema), blogController.updateBlogCategory);
router.delete("/:id", blogController.deleteBlogCategory);
router.delete("/:id/permanent", blogController.deleteBlogCategoryPermanently);

export default router;
