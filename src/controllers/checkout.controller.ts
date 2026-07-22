import { Request, Response, NextFunction } from "express";
import { PoolClient } from "pg";
import { pool } from "../config/database";
import { success, error } from "../utils/response";
import { AppError } from "../utils/errors";
import { logger } from "../config/logger";
import { computeBookingDateTime, assertNoDuplicateBooking, generateOrderNumber } from "../services/booking.service";
import { validateCoupon } from "../services/coupon.service";
import { createRazorpayOrder, verifyPaymentSignature, verifyWebhookSignature } from "../services/razorpay.service";
import { razorpay } from "../config/razorpay";
import { env } from "../config/env";
import { findActiveServiceById } from "../queries/service.queries";
import {
  createOrder as createOrderQuery,
  insertOrderMember,
  findOrderById,
  updateOrderStatus,
  getAppSettingByKey,
} from "../queries/order.queries";
import {
  createPayment,
  findPaymentByRazorpayOrderId,
  findPaymentByRazorpayPaymentId,
  markPaymentCaptured,
  markPaymentFailed,
  markPaymentRefunded,
} from "../queries/payment.queries";
import { insertCouponUsage, incrementCouponUsageCount } from "../queries/coupon.queries";

interface PgError {
  code?: string;
  constraint?: string;
}

const MAX_ORDER_NUMBER_RETRIES = 5;

const createOrderWithMembers = async (orderValues: unknown[], members: string[]) => {
  const client: PoolClient = await pool.connect();
  try {
    let order: Record<string, unknown> | undefined;

    for (let attempt = 0; attempt < MAX_ORDER_NUMBER_RETRIES; attempt++) {
      const orderNumber = await generateOrderNumber();
      try {
        await client.query("BEGIN");
        const result = await client.query(createOrderQuery, [orderNumber, ...orderValues]);
        order = result.rows[0];
        for (const [i, name] of members.entries()) {
          await client.query(insertOrderMember, [order!.id, name, i]);
        }
        await client.query("COMMIT");
        break;
      } catch (err) {
        await client.query("ROLLBACK");
        const pgErr = err as PgError;
        const isOrderNumberConflict = pgErr.code === "23505" && pgErr.constraint === "orders_order_number_key";
        if (isOrderNumberConflict && attempt < MAX_ORDER_NUMBER_RETRIES - 1) continue;
        throw err;
      }
    }

    if (!order) throw new AppError("INTERNAL_ERROR", "Failed to generate a unique order number", 500);
    return order;
  } finally {
    client.release();
  }
};

export const createOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      service_id, booking_date, booking_time, customer_name, customer_phone, customer_whatsapp,
      customer_calling_number, customer_email, members, gotra, gotra_unknown, coupon_code,
      address, city, pincode, special_instructions, birth_date, birth_time, birth_place,
    } = req.body;
    const userId = req.user!.id;

    const serviceResult = await pool.query(findActiveServiceById, [service_id]);
    const service = serviceResult.rows[0];
    if (!service) throw new AppError("NOT_FOUND", "Service not found or not available for booking", 404);

    const bookingDateTime = computeBookingDateTime(booking_date, booking_time);
    await assertNoDuplicateBooking(userId, service_id, booking_date);

    const basePrice = Number(service.price);
    let discountAmount = 0;
    let couponId: string | null = null;
    let couponCode: string | null = null;

    if (coupon_code) {
      const validation = await validateCoupon(coupon_code, userId, basePrice, service_id);
      if (!validation.valid) {
        throw new AppError("COUPON_INVALID", validation.message ?? "Coupon is not valid", 400);
      }
      discountAmount = validation.discount_amount!;
      couponId = validation.coupon!.id;
      couponCode = validation.coupon!.code;
    }

    const settingResult = await pool.query<{ value: string }>(getAppSettingByKey, ["convenience_fee"]);
    const convenienceFee = settingResult.rows[0] ? Number(settingResult.rows[0].value) : 0;
    const totalAmount = Math.round((basePrice - discountAmount + convenienceFee) * 100) / 100;

    const order = await createOrderWithMembers(
      [
        userId, service_id, customer_name, customer_phone, customer_whatsapp ?? null,
        customer_calling_number ?? null, customer_email ?? null, gotra ?? null, gotra_unknown,
        booking_date, booking_time, bookingDateTime, address ?? null, city ?? null, pincode ?? null,
        basePrice, discountAmount, convenienceFee, totalAmount, couponId, couponCode,
        birth_date ?? null, birth_time ?? null, birth_place ?? null, special_instructions ?? null,
      ],
      members
    );

    let razorpayOrder;
    try {
      razorpayOrder = await createRazorpayOrder(totalAmount, order.order_number as string, {
        order_id: order.id as string,
        service_id,
      });
    } catch (err) {
      logger.error("Razorpay order creation failed", { err, orderId: order.id });
      throw new AppError("PAYMENT_GATEWAY_ERROR", "Failed to initialize payment. Please try again.", 502);
    }

    await pool.query(createPayment, [order.id, razorpayOrder.id, totalAmount]);

    return success(
      res,
      {
        order: { id: order.id, order_number: order.order_number, total_amount: totalAmount },
        razorpay: {
          order_id: razorpayOrder.id,
          amount: Math.round(totalAmount * 100),
          currency: "INR",
          key_id: env.RAZORPAY_KEY_ID,
        },
      },
      "Order created",
      201
    );
  } catch (err) {
    next(err);
  }
};

// Locks the payment row for the duration of the transaction so a webhook
// delivery and the client's own verify-payment call — which can legitimately
// arrive within milliseconds of each other — can't both pass the "not yet
// captured" check and double-insert coupon_usages / double-increment
// usage_count. Whichever gets the lock first wins; the other sees the
// already-captured status once it acquires the lock and no-ops.
const finalizeSuccessfulPayment = async (
  paymentId: string,
  razorpayPaymentId: string,
  razorpaySignature: string | null,
  method: string | null
) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const lockedPayment = await client.query(
      "SELECT * FROM payments WHERE id = $1 FOR UPDATE",
      [paymentId]
    );
    const payment = lockedPayment.rows[0];

    if (payment.status === "captured") {
      const existingOrder = await client.query(findOrderById, [payment.order_id]);
      await client.query("COMMIT");
      return existingOrder.rows[0];
    }

    await client.query(markPaymentCaptured, [payment.id, razorpayPaymentId, razorpaySignature, method]);
    const orderResult = await client.query(updateOrderStatus, [payment.order_id, "confirmed"]);
    const order = orderResult.rows[0];

    if (order.coupon_id) {
      await client.query(insertCouponUsage, [order.coupon_id, order.user_id, order.id]);
      await client.query(incrementCouponUsageCount, [order.coupon_id]);
    }

    await client.query("COMMIT");
    return order;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

export const verifyPayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const paymentResult = await pool.query(findPaymentByRazorpayOrderId, [razorpay_order_id]);
    const payment = paymentResult.rows[0];
    if (!payment) throw new AppError("NOT_FOUND", "Payment record not found", 404);

    if (payment.status === "captured") {
      const orderResult = await pool.query(findOrderById, [payment.order_id]);
      const order = orderResult.rows[0];
      return success(res, {
        order: { id: order.id, order_number: order.order_number, status: order.status },
        payment: { status: payment.status, method: payment.method },
      });
    }

    const signatureValid = verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    if (!signatureValid) {
      await pool.query(markPaymentFailed, [
        payment.id, "SIGNATURE_MISMATCH", "Razorpay signature verification failed", "signature_verification_failed",
      ]);
      throw new AppError("PAYMENT_FAILED", "Payment signature verification failed", 400);
    }

    let method: string | null = null;
    try {
      const razorpayPayment = await razorpay.payments.fetch(razorpay_payment_id);
      method = razorpayPayment.method ?? null;
    } catch (err) {
      logger.error("Failed to fetch Razorpay payment details", { err, razorpay_payment_id });
    }

    const order = await finalizeSuccessfulPayment(payment.id, razorpay_payment_id, razorpay_signature, method);

    return success(res, {
      order: { id: order.id, order_number: order.order_number, status: order.status },
      payment: { status: "captured", method },
    });
  } catch (err) {
    next(err);
  }
};

export const razorpayWebhook = async (req: Request, res: Response) => {
  try {
    const signature = req.headers["x-razorpay-signature"] as string | undefined;
    if (!signature || !req.rawBody || !verifyWebhookSignature(req.rawBody, signature)) {
      return error(res, "Invalid webhook signature", 400);
    }

    const event = req.body.event as string;

    if (event === "payment.captured") {
      const entity = req.body.payload?.payment?.entity;
      const payment = (await pool.query(findPaymentByRazorpayOrderId, [entity.order_id])).rows[0];
      if (payment && payment.status !== "captured") {
        await finalizeSuccessfulPayment(payment.id, entity.id, null, entity.method ?? null);
      }
    } else if (event === "payment.failed") {
      const entity = req.body.payload?.payment?.entity;
      const payment = (await pool.query(findPaymentByRazorpayOrderId, [entity.order_id])).rows[0];
      if (payment && payment.status !== "failed" && payment.status !== "captured") {
        await pool.query(markPaymentFailed, [
          payment.id, entity.error_code ?? null, entity.error_description ?? null, entity.error_reason ?? null,
        ]);
      }
    } else if (event === "refund.created") {
      const entity = req.body.payload?.refund?.entity;
      const payment = (await pool.query(findPaymentByRazorpayPaymentId, [entity.payment_id])).rows[0];
      if (payment && payment.status !== "refunded") {
        await pool.query(markPaymentRefunded, [payment.id, entity.amount / 100, entity.id]);
        await pool.query(updateOrderStatus, [payment.order_id, "refunded"]);
      }
    }

    return success(res, null, "Webhook processed");
  } catch (err) {
    logger.error("Webhook processing error", { err });
    return error(res, "Webhook processing failed", 500);
  }
};
