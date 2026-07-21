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

router.post("/", setUploadFolder, categoryUploads, validate(createCategorySchema), categoryController.createCategory);
router.get("/", categoryController.listCategoriesAdmin);
router.get("/:id", categoryController.getCategory);
router.patch("/:id", setUploadFolder, categoryUploads, validate(updateCategorySchema), categoryController.updateCategory);
router.delete("/:id", categoryController.deleteCategory);

export default router;
