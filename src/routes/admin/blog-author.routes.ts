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

router.post("/", setUploadFolder, uploadSingle("avatar"), validate(createBlogAuthorSchema), blogController.createBlogAuthor);
router.get("/", blogController.listBlogAuthorsAdmin);
router.patch("/:id", setUploadFolder, uploadSingle("avatar"), validate(updateBlogAuthorSchema), blogController.updateBlogAuthor);
router.delete("/:id", blogController.deleteBlogAuthor);

export default router;
