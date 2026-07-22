import { Router } from "express";
import * as reviewController from "../../controllers/review.controller";
import { validate } from "../../middleware/validate";
import { moderateReviewSchema } from "../../validators/booking.schema";

const router = Router();

router.patch("/:id", validate(moderateReviewSchema), reviewController.moderateReview);
router.delete("/:id", reviewController.deleteReviewAdmin);

export default router;
