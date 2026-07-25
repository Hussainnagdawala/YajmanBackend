import { Router, Request, Response, NextFunction } from "express";
import * as notificationController from "../../controllers/admin/notification.controller";
import { validate } from "../../middleware/validate";
import { uploadSingle } from "../../middleware/upload";
import {
  createCampaignSchema,
  updateCampaignSchema,
  listCampaignsQuerySchema,
  listRecipientsQuerySchema,
} from "../../validators/notification.schema";

const router = Router();

const setUploadFolder = (req: Request, _res: Response, next: NextFunction) => {
  req.uploadFolder = "notifications";
  next();
};

router.post(
  "/",
  setUploadFolder,
  uploadSingle("image"),
  validate(createCampaignSchema),
  notificationController.createCampaign
);
router.get("/", validate(listCampaignsQuerySchema, "query"), notificationController.listCampaigns);
router.get(
  "/:id",
  validate(listRecipientsQuerySchema, "query"),
  notificationController.getCampaign
);
router.put(
  "/:id",
  setUploadFolder,
  uploadSingle("image"),
  validate(updateCampaignSchema),
  notificationController.updateCampaign
);
router.delete("/:id", notificationController.deleteCampaign);
router.post("/:id/send", notificationController.sendCampaign);
router.post("/:id/resend", notificationController.resendCampaign);
router.post("/:id/duplicate", notificationController.duplicateCampaign);
router.post("/:id/cancel", notificationController.cancelCampaign);

export default router;
