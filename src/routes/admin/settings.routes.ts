import { Router } from "express";
import * as settingsController from "../../controllers/admin/settings.controller";
import { validate } from "../../middleware/validate";
import {
  listSettingsQuerySchema,
  settingKeyParamSchema,
  bulkUpdateSettingsSchema,
  patchSettingSchema,
} from "../../validators/settings.schema";

const router = Router();

router.get("/", validate(listSettingsQuerySchema, "query"), settingsController.listSettings);
router.put("/", validate(bulkUpdateSettingsSchema), settingsController.bulkUpdateSettings);
router.get("/:key", validate(settingKeyParamSchema, "params"), settingsController.getSetting);
router.patch(
  "/:key",
  validate(settingKeyParamSchema, "params"),
  validate(patchSettingSchema),
  settingsController.patchSetting
);

export default router;
