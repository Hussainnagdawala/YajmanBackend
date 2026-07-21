import { Router } from "express";
import * as profileController from "../controllers/profile.controller";
import { validate } from "../middleware/validate";
import { uploadSingle } from "../middleware/upload";
import { updateProfileSchema } from "../validators/profile.schema";

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

export default router;
