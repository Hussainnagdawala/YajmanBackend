import { Router, Request, Response, NextFunction } from "express";
import * as serviceController from "../controllers/service.controller";
import * as reviewController from "../controllers/review.controller";
import * as contactController from "../controllers/contact.controller";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { uploadArray } from "../middleware/upload";
import { listServicesQuerySchema } from "../validators/service.schema";
import { submitServiceReviewSchema, listServiceReviewsQuerySchema } from "../validators/booking.schema";
import { createServiceInquirySchema } from "../validators/contact.schema";

const router = Router();

const setUploadFolder = (req: Request, _res: Response, next: NextFunction) => {
  req.uploadFolder = "reviews";
  next();
};

router.get("/bestsellers", serviceController.getBestsellers);
router.get("/:id/reviews", validate(listServiceReviewsQuerySchema, "query"), reviewController.listServiceReviews);
router.post(
  "/:id/reviews",
  authenticate,
  setUploadFolder,
  uploadArray("photos", 5),
  validate(submitServiceReviewSchema),
  reviewController.submitReviewViaService
);
router.post("/:id/inquiry", validate(createServiceInquirySchema), contactController.createServiceInquiry);
router.get("/:slug", serviceController.getServiceBySlug);
router.get("/", validate(listServicesQuerySchema, "query"), serviceController.listServicesPublic);

export default router;
