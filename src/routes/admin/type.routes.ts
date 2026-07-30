import { Router, Request, Response, NextFunction } from "express";
import * as typeController from "../../controllers/type.controller";
import { validate } from "../../middleware/validate";
import { uploadSingle } from "../../middleware/upload";
import { createTypeSchema, updateTypeSchema } from "../../validators/category.schema";

const router = Router();

const setUploadFolder = (req: Request, _res: Response, next: NextFunction) => {
  req.uploadFolder = "types";
  next();
};

router.post("/", setUploadFolder, uploadSingle("image"), validate(createTypeSchema), typeController.createType);
router.get("/", typeController.listTypesAdmin);
router.patch("/:id", setUploadFolder, uploadSingle("image"), validate(updateTypeSchema), typeController.updateType);
router.delete("/:id", typeController.deleteType);
router.delete("/:id/permanent", typeController.deleteTypePermanently);

export default router;
