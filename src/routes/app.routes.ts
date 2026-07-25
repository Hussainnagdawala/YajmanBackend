import { Router } from "express";
import * as appSettingsController from "../controllers/app-settings.controller";
import { validate } from "../middleware/validate";
import { publicSettingsQuerySchema } from "../validators/settings.schema";

const router = Router();

router.get(
  "/settings",
  validate(publicSettingsQuerySchema, "query"),
  appSettingsController.getAppSettings
);

export default router;
