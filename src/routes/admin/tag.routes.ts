import { Router } from "express";
import * as tagController from "../../controllers/tag.controller";
import { validate } from "../../middleware/validate";
import { createTagSchema, updateTagSchema } from "../../validators/category.schema";

const router = Router();

router.post("/", validate(createTagSchema), tagController.createTag);
router.get("/", tagController.listTagsAdmin);
router.patch("/:id", validate(updateTagSchema), tagController.updateTag);
router.delete("/:id", tagController.deleteTag);

export default router;
