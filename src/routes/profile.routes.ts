import { Router } from "express";
import * as profileController from "../controllers/profile.controller";
import { validate } from "../middleware/validate";
import { uploadSingle } from "../middleware/upload";
import { updateProfileSchema } from "../validators/profile.schema";
import { registerDeviceTokenSchema, removeDeviceTokenSchema } from "../validators/device.schema";

const router = Router();

router.get("/", profileController.getProfile);
router.patch("/", validate(updateProfileSchema), profileController.updateProfile);
router.post(
  "/avatar",
  (req, _res, next) => {
    req.uploadFolder = "avatars";
    next();
  },
  uploadSingle("avatar"),
  profileController.uploadAvatar
);

router.post("/device-tokens", validate(registerDeviceTokenSchema), profileController.registerDeviceToken);
router.get("/device-tokens", profileController.listDeviceTokens);
router.delete("/device-tokens", validate(removeDeviceTokenSchema), profileController.removeDeviceToken);

export default router;
