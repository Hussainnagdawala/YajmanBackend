import { Router, Request, Response, NextFunction } from "express";
import * as serviceController from "../../controllers/service.controller";
import { validate } from "../../middleware/validate";
import { uploadSingle } from "../../middleware/upload";
import { createTempleSchema, updateTempleSchema } from "../../validators/service.schema";

const router = Router();

const setUploadFolder = (req: Request, _res: Response, next: NextFunction) => {
  req.uploadFolder = "temples";
  next();
};

router.post("/", setUploadFolder, uploadSingle("image"), validate(createTempleSchema), serviceController.createTemple);
router.get("/", serviceController.listTemplesAdmin);
router.patch("/:id", setUploadFolder, uploadSingle("image"), validate(updateTempleSchema), serviceController.updateTemple);
router.delete("/:id", serviceController.deleteTemple);
router.delete("/:id/permanent", serviceController.deleteTemplePermanently);

export default router;
