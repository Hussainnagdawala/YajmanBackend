import crypto from "crypto";
import { razorpay } from "../config/razorpay";
import { env } from "../config/env";

export const createRazorpayOrder = async (amountRupees: number, receipt: string, notes: Record<string, string>) => {
  return razorpay.orders.create({
    amount: Math.round(amountRupees * 100),
    currency: "INR",
    receipt,
    notes,
  });
};

const safeEqual = (a: string, b: string): boolean => {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};

export const verifyPaymentSignature = (
  razorpayOrderId: string,
  razorpayPaymentId: string,
  signature: string
): boolean => {
  const expected = crypto
    .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");
  return safeEqual(expected, signature);
};

export const verifyWebhookSignature = (rawBody: Buffer, signature: string): boolean => {
  const expected = crypto
    .createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");
  return safeEqual(expected, signature);
};
