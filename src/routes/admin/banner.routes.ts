import { Router, Request, Response, NextFunction } from "express";
import * as homeController from "../../controllers/home.controller";
import { validate } from "../../middleware/validate";
import { uploadFields } from "../../middleware/upload";
import {
  createBannerSchema,
  updateBannerSchema,
} from "../../validators/home.schema";

const router = Router();

const setUploadFolder = (req: Request, _res: Response, next: NextFunction) => {
  req.uploadFolder = "banners";
  next();
};

const bannerUploads = uploadFields([
  { name: "image", maxCount: 1 },
  { name: "mobile_image", maxCount: 1 },
]);

router.post(
  "/",
  setUploadFolder,
  bannerUploads,
  validate(createBannerSchema),
  homeController.createBanner,
);
router.get("/", homeController.listBannersAdmin);
router.patch(
  "/:id",
  setUploadFolder,
  bannerUploads,
  validate(updateBannerSchema),
  homeController.updateBanner,
);
router.delete("/:id", homeController.deleteBanner);
router.delete("/:id/permanent", homeController.deleteBannerPermanently);

export default router;
