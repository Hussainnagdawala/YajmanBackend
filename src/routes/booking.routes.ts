import { Router, Request, Response, NextFunction } from "express";
import * as bookingController from "../controllers/booking.controller";
import * as reviewController from "../controllers/review.controller";
import * as invoiceController from "../controllers/invoice.controller";
import { validate } from "../middleware/validate";
import { uploadArray } from "../middleware/upload";
import { listBookingsQuerySchema, cancelBookingSchema, submitReviewSchema } from "../validators/booking.schema";

const router = Router();

const setUploadFolder = (req: Request, _res: Response, next: NextFunction) => {
  req.uploadFolder = "reviews";
  next();
};

router.get("/", validate(listBookingsQuerySchema, "query"), bookingController.listBookings);
router.get("/:id", bookingController.getBookingDetail);
router.get("/:id/invoice", invoiceController.getBookingInvoice);
router.patch("/:id/cancel", validate(cancelBookingSchema), bookingController.cancelBooking);
router.post(
  "/:id/review",
  setUploadFolder,
  uploadArray("photos", 5),
  validate(submitReviewSchema),
  reviewController.submitReviewViaBooking
);

export default router;
