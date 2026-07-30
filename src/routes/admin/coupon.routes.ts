import { Router } from "express";
import * as couponController from "../../controllers/coupon.controller";
import { validate } from "../../middleware/validate";
import { createCouponSchema, updateCouponSchema } from "../../validators/coupon.schema";

const router = Router();

router.post("/", validate(createCouponSchema), couponController.createCoupon);
router.get("/", couponController.listCouponsAdmin);
router.patch("/:id", validate(updateCouponSchema), couponController.updateCoupon);
router.delete("/:id", couponController.deleteCoupon);
router.delete("/:id/permanent", couponController.deleteCouponPermanently);

export default router;
