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

router.post("/", setUploadFolder, blogUploads, validate(createBlogSchema), blogController.createBlog);
router.get("/", blogController.listBlogsAdmin);
router.patch("/:id", setUploadFolder, blogUploads, validate(updateBlogSchema), blogController.updateBlog);
router.delete("/:id", blogController.deleteBlog);

export default router;
