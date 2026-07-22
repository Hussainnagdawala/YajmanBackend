import { Router, Request, Response, NextFunction } from "express";
import * as aayojanController from "../../controllers/aayojan.controller";
import { validate } from "../../middleware/validate";
import { uploadFields, uploadSingle } from "../../middleware/upload";
import {
  createAayojanContentSchema,
  updateAayojanContentSchema,
  createAayojanEventSchema,
  updateAayojanEventSchema,
  createAayojanBannerSchema,
  updateAayojanBannerSchema,
} from "../../validators/aayojan.schema";

const router = Router();

const setUploadFolder = (folder: string) => (req: Request, _res: Response, next: NextFunction) => {
  req.uploadFolder = folder;
  next();
};

// ─── Page content ────────────────────────────────────────────
const contentUploads = uploadFields([{ name: "image", maxCount: 1 }]);

router.post(
  "/content",
  setUploadFolder("aayojan"),
  contentUploads,
  validate(createAayojanContentSchema),
  aayojanController.createAayojanContent
);
router.get("/content", aayojanController.listAayojanContentAdmin);
router.patch(
  "/content/:id",
  setUploadFolder("aayojan"),
  contentUploads,
  validate(updateAayojanContentSchema),
  aayojanController.updateAayojanContent
);
router.delete("/content/:id", aayojanController.deleteAayojanContent);

// ─── Events ──────────────────────────────────────────────────
const eventUploads = uploadFields([
  { name: "feature_image", maxCount: 1 },
  { name: "images", maxCount: 20 },
]);

router.post(
  "/events",
  setUploadFolder("aayojan"),
  eventUploads,
  validate(createAayojanEventSchema),
  aayojanController.createAayojanEvent
);
router.get("/events", aayojanController.listAayojanEventsAdmin);
router.patch(
  "/events/:id",
  setUploadFolder("aayojan"),
  eventUploads,
  validate(updateAayojanEventSchema),
  aayojanController.updateAayojanEvent
);
router.delete("/events/:id", aayojanController.deleteAayojanEvent);

// ─── Banners ─────────────────────────────────────────────────

router.post(
  "/banners",
  setUploadFolder("aayojan"),
  uploadSingle("image"),
  validate(createAayojanBannerSchema),
  aayojanController.createAayojanBanner
);
router.get("/banners", aayojanController.listAayojanBannersAdmin);
router.patch(
  "/banners/:id",
  setUploadFolder("aayojan"),
  uploadSingle("image"),
  validate(updateAayojanBannerSchema),
  aayojanController.updateAayojanBanner
);
router.delete("/banners/:id", aayojanController.deleteAayojanBanner);

export default router;
