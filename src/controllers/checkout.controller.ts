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
import { listAddonsForService } from "../queries/addon.queries";
import {
  createOrder as createOrderQuery,
  insertOrderMember,
  insertOrderAddon,
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
  storeWebhookRawResponse,
} from "../queries/payment.queries";
import { insertCouponUsage, incrementCouponUsageCount } from "../queries/coupon.queries";
import { logOrderActivity } from "../services/booking.service";

interface PgError {
  code?: string;
  constraint?: string;
}

const MAX_ORDER_NUMBER_RETRIES = 5;

interface SelectedAddon {
  id: string;
  name: string;
  price: number;
}

const createOrderWithMembers = async (
  orderValues: unknown[],
  members: string[],
  selectedAddons: SelectedAddon[]
) => {
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
        for (const addon of selectedAddons) {
          await client.query(insertOrderAddon, [order!.id, addon.id, addon.name, addon.price]);
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
      customer_calling_number, customer_email, members, addon_ids, gotra, gotra_unknown, coupon_code,
      address, city, pincode, special_instructions, birth_date, birth_time, birth_place,
    } = req.body;
    const userId = req.user!.id;

    const serviceResult = await pool.query(findActiveServiceById, [service_id]);
    const service = serviceResult.rows[0];
    if (!service) throw new AppError("NOT_FOUND", "Service not found or not available for booking", 404);

    // Categories with no price never had a checkout flow to begin with — they're
    // enquiry-only (POST /services/:id/inquiry). Reject here instead of silently
    // auto-confirming a ₹0 order, which used to be this endpoint's behavior.
    if (!service.requires_payment) {
      throw new AppError(
        "VALIDATION_ERROR",
        "This service does not accept online bookings — submit an inquiry instead (POST /services/:id/inquiry)",
        400
      );
    }

    if (
      (service.availability_start_date && booking_date < service.availability_start_date) ||
      (service.availability_end_date && booking_date > service.availability_end_date)
    ) {
      throw new AppError("VALIDATION_ERROR", "The selected booking date is outside this service's availability period", 400, [
        { field: "booking_date", message: "Please choose a date within the service's available date range" },
      ]);
    }
    if (service.booking_availability_type === "specific_day" && !service.available_dates.includes(booking_date)) {
      throw new AppError("VALIDATION_ERROR", "The selected date is not available for this service", 400, [
        { field: "booking_date", message: "Please choose one of the dates listed as available for this service" },
      ]);
    }

    const bookingDateTime = computeBookingDateTime(booking_date, booking_time, service.advance_booking_days);
    await assertNoDuplicateBooking(userId, service_id, booking_date);

    const requestedAddonIds: string[] = addon_ids ?? [];
    let selectedAddons: SelectedAddon[] = [];
    if (requestedAddonIds.length > 0) {
      if (!service.is_addon_available) {
        throw new AppError("VALIDATION_ERROR", "Add-ons are not available for this service", 400, [
          { field: "addon_ids", message: "This service does not offer add-ons" },
        ]);
      }
      const availableAddons = (await pool.query(listAddonsForService, [service_id])).rows;
      const availableById = new Map(availableAddons.map((a) => [a.id, a]));
      for (const id of requestedAddonIds) {
        if (!availableById.has(id)) {
          throw new AppError("VALIDATION_ERROR", "One or more selected add-ons are not available for this service", 400, [
            { field: "addon_ids", message: `Add-on '${id}' is not available for this service` },
          ]);
        }
      }
      selectedAddons = requestedAddonIds.map((id) => {
        const a = availableById.get(id);
        return { id: a.id, name: a.name, price: Number(a.price) };
      });
    }
    const addonTotal = selectedAddons.reduce((sum, a) => sum + a.price, 0);

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
    // Coupon discount applies to basePrice only — addons are added on top, undiscounted.
    const totalAmount = Math.round((basePrice + addonTotal - discountAmount + convenienceFee) * 100) / 100;

    const order = await createOrderWithMembers(
      [
        userId, service_id, customer_name, customer_phone, customer_whatsapp ?? null,
        customer_calling_number ?? null, customer_email ?? null, gotra ?? null, gotra_unknown,
        booking_date, booking_time, bookingDateTime, address ?? null, city ?? null, pincode ?? null,
        basePrice, discountAmount, convenienceFee, totalAmount, couponId, couponCode,
        birth_date ?? null, birth_time ?? null, birth_place ?? null, special_instructions ?? null,
        addonTotal,
      ],
      members,
      selectedAddons
    );

    let razorpayOrder;
    try {
      razorpayOrder = await createRazorpayOrder(totalAmount, order.order_number as string, {
        order_id: order.id as string,
        service_id,
      });
    } catch (err) {
      logger.error("Razorpay order creation failed", { err, orderId: order.id });
      await pool.query(updateOrderStatus, [order.id, "payment_failed"]);
      await logOrderActivity(userId, "order_payment_init_failed", order.id as string, {
        description: "Razorpay order creation failed",
      });
      throw new AppError("PAYMENT_GATEWAY_ERROR", "Failed to initialize payment. Please try again.", 502);
    }

    await pool.query(createPayment, [order.id, razorpayOrder.id, totalAmount]);

    return success(
      res,
      {
        order: { id: order.id, order_number: order.order_number, total_amount: totalAmount },
        payment_required: true,
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
      await pool.query(updateOrderStatus, [payment.order_id, "payment_failed"]);
      await logOrderActivity(req.user!.id, "payment_signature_mismatch", payment.order_id, {
        description: "Razorpay signature verification failed",
      });
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
        await pool.query(updateOrderStatus, [payment.order_id, "payment_failed"]);
        await logOrderActivity(undefined, "payment_webhook_failed", payment.order_id, {
          description: `Razorpay reported payment failure: ${entity.error_description ?? entity.error_code ?? "unknown"}`,
        });
      }
    } else if (event === "refund.created") {
      const entity = req.body.payload?.refund?.entity;
      const payment = (await pool.query(findPaymentByRazorpayPaymentId, [entity.payment_id])).rows[0];
      if (payment && payment.status !== "refunded") {
        await pool.query(markPaymentRefunded, [payment.id, entity.amount / 100, entity.id]);
        await pool.query(updateOrderStatus, [payment.order_id, "refunded"]);
      }
    } else if (event === "payment.dispute.created") {
      const entity = req.body.payload?.dispute?.entity;
      const payment = (await pool.query(findPaymentByRazorpayPaymentId, [entity.payment_id])).rows[0];
      if (payment) {
        await pool.query(storeWebhookRawResponse, [payment.id, JSON.stringify(entity)]);
        await pool.query(updateOrderStatus, [payment.order_id, "disputed"]);
        logger.error("Razorpay payment dispute raised — needs manual handling", {
          orderId: payment.order_id, paymentId: payment.id, disputeId: entity.id,
        });
        await logOrderActivity(undefined, "payment_disputed", payment.order_id, {
          description: `Razorpay dispute raised (${entity.id}) — respond by the deadline in the Razorpay dashboard`,
        });
      }
    } else {
      logger.warn("Unhandled Razorpay webhook event", { event });
    }

    return success(res, null, "Webhook processed");
  } catch (err) {
    logger.error("Webhook processing error", { err });
    return error(res, "Webhook processing failed", 500);
  }
};
