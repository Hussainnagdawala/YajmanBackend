import { Router, Request, Response, NextFunction } from "express";
import * as addonController from "../../controllers/addon.controller";
import { validate } from "../../middleware/validate";
import { uploadSingle } from "../../middleware/upload";
import { createAddonSchema, updateAddonSchema } from "../../validators/addon.schema";

const router = Router();

const setUploadFolder = (req: Request, _res: Response, next: NextFunction) => {
  req.uploadFolder = "addons";
  next();
};

router.post("/", setUploadFolder, uploadSingle("image"), validate(createAddonSchema), addonController.createAddon);
router.get("/", addonController.listAddonsAdmin);
router.patch("/:id", setUploadFolder, uploadSingle("image"), validate(updateAddonSchema), addonController.updateAddon);
router.delete("/:id", addonController.deleteAddon);
router.delete("/:id/permanent", addonController.deleteAddonPermanently);

export default router;
