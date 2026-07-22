import { Router } from "express";
import * as serviceController from "../../controllers/service.controller";
import { validate } from "../../middleware/validate";
import { createTempleSchema, updateTempleSchema } from "../../validators/service.schema";

const router = Router();

router.post("/", validate(createTempleSchema), serviceController.createTemple);
router.get("/", serviceController.listTemplesAdmin);
router.patch("/:id", validate(updateTempleSchema), serviceController.updateTemple);
router.delete("/:id", serviceController.deleteTemple);

export default router;
