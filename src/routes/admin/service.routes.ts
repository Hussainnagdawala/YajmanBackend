import { Router, Request, Response, NextFunction } from "express";
import * as serviceController from "../../controllers/service.controller";
import { validate } from "../../middleware/validate";
import { uploadFields, uploadArray } from "../../middleware/upload";
import { createServiceSchema, updateServiceSchema } from "../../validators/service.schema";

const router = Router();

const setUploadFolder = (req: Request, _res: Response, next: NextFunction) => {
  req.uploadFolder = "services";
  next();
};

const serviceUploads = uploadFields([
  { name: "feature_image", maxCount: 1 },
  { name: "images", maxCount: 20 },
]);

router.post("/", setUploadFolder, serviceUploads, validate(createServiceSchema), serviceController.createService);
router.patch("/:id", setUploadFolder, serviceUploads, validate(updateServiceSchema), serviceController.updateService);
router.delete("/:id", serviceController.deleteService);
router.post("/:id/images", setUploadFolder, uploadArray("images", 20), serviceController.addServiceImages);
router.delete("/:id/images/:imageId", serviceController.deleteServiceImage);

export default router;
