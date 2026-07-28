import { Router } from "express";
import * as panditController from "../../controllers/pandit.controller";
import { validate } from "../../middleware/validate";
import { listPanditsAdminQuerySchema } from "../../validators/pandit.schema";

const router = Router();

router.get("/", validate(listPanditsAdminQuerySchema, "query"), panditController.listPanditsAdmin);
router.get("/:id", panditController.getPanditAdmin);

export default router;
