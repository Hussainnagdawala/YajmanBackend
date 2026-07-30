import { Router, Request, Response, NextFunction } from "express";
import * as homeController from "../../controllers/home.controller";
import { validate } from "../../middleware/validate";
import { uploadSingle } from "../../middleware/upload";
import { createTestimonialSchema, updateTestimonialSchema } from "../../validators/home.schema";

const router = Router();

const setUploadFolder = (req: Request, _res: Response, next: NextFunction) => {
  req.uploadFolder = "testimonials";
  next();
};

router.post("/", setUploadFolder, uploadSingle("avatar"), validate(createTestimonialSchema), homeController.createTestimonial);
router.get("/", homeController.listTestimonialsAdmin);
router.patch("/:id", setUploadFolder, uploadSingle("avatar"), validate(updateTestimonialSchema), homeController.updateTestimonial);
router.delete("/:id", homeController.deleteTestimonial);
router.delete("/:id/permanent", homeController.deleteTestimonialPermanently);

export default router;
