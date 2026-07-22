import { Router } from "express";
import * as checkoutController from "../controllers/checkout.controller";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createOrderSchema, verifyPaymentSchema } from "../validators/checkout.schema";

const router = Router();

// No auth: called directly by Razorpay, verified via webhook signature instead.
router.post("/webhook", checkoutController.razorpayWebhook);

router.post("/create-order", authenticate, validate(createOrderSchema), checkoutController.createOrder);
router.post("/verify-payment", authenticate, validate(verifyPaymentSchema), checkoutController.verifyPayment);

export default router;
