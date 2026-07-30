import { Router } from "express";
import * as homeController from "../../controllers/home.controller";
import { validate } from "../../middleware/validate";
import { createPopularSearchSchema, updatePopularSearchSchema } from "../../validators/home.schema";

const router = Router();

router.post("/", validate(createPopularSearchSchema), homeController.createPopularSearch);
router.get("/", homeController.listPopularSearchesAdmin);
router.patch("/:id", validate(updatePopularSearchSchema), homeController.updatePopularSearch);
router.delete("/:id", homeController.deletePopularSearch);
router.delete("/:id/permanent", homeController.deletePopularSearchPermanently);

export default router;
