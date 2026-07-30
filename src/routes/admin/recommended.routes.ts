import { Router } from "express";
import * as homeController from "../../controllers/home.controller";
import { validate } from "../../middleware/validate";
import { createRecommendedServiceSchema, updateRecommendedServiceSchema } from "../../validators/home.schema";

const router = Router();

router.post("/", validate(createRecommendedServiceSchema), homeController.createRecommendedService);
router.get("/", homeController.listRecommendedServicesAdmin);
router.patch("/:id", validate(updateRecommendedServiceSchema), homeController.updateRecommendedService);
router.delete("/:id", homeController.deleteRecommendedService);
router.delete("/:id/permanent", homeController.deleteRecommendedServicePermanently);

export default router;
