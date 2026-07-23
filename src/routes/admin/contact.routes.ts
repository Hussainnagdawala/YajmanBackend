import { Router } from "express";
import * as contactController from "../../controllers/contact.controller";
import { validate } from "../../middleware/validate";
import { updateContactEntrySchema, listContactEntriesQuerySchema } from "../../validators/contact.schema";

const router = Router();

router.get("/", validate(listContactEntriesQuerySchema, "query"), contactController.listContactEntriesAdmin);
router.patch("/:id", validate(updateContactEntrySchema), contactController.updateContactEntryAdmin);

export default router;
