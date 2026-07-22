import { Router } from "express";
import * as couponController from "../controllers/coupon.controller";
import { validate } from "../middleware/validate";
import { validateCouponSchema } from "../validators/coupon.schema";

const router = Router();

router.post("/validate", validate(validateCouponSchema), couponController.validateCouponHandler);

export default router;
