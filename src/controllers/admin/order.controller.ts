import { Request, Response, NextFunction } from "express";
import { pool } from "../../config/database";
import { success } from "../../utils/response";
import { AppError } from "../../utils/errors";
import { paginate } from "../../utils/pagination";
import { logger } from "../../config/logger";
import { razorpay } from "../../config/razorpay";
import { assertValidStatusTransition, cancelOrderWithRefund, logOrderActivity } from "../../services/booking.service";
import { resolveInvoicePdfUrl } from "../../services/invoice.service";
import { findLatestPaymentForOrder } from "../../queries/booking.queries";
import { markPaymentRefunded } from "../../queries/payment.queries";
import {
  listOrdersAdmin as listOrdersAdminQuery,
  countOrdersAdmin,
  findOrderDetailAdmin,
  findOrderById,
  updateOrderStatus,
  updateOrderStatusAdmin as updateOrderStatusAdminQuery,
  getOrderActivity as getOrderActivityQuery,
} from "../../queries/order.queries";

export const listOrdersAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = req.query as unknown as {
      status?: string;
      from?: string;
      to?: string;
      search?: string;
      page: number;
      limit: number;
    };
    const { limit: safeLimit, offset, meta } = paginate(q.page, q.limit);

    const values: unknown[] = [];
    const whereClauses: string[] = [];
    if (q.status && q.status !== "all") {
      values.push(q.status);
      whereClauses.push(`o.status = $${values.length}`);
    }
    if (q.from) {
      values.push(q.from);
      whereClauses.push(`o.created_at >= $${values.length}`);
    }
    if (q.to) {
      values.push(q.to);
      whereClauses.push(`o.created_at <= $${values.length}::date + INTERVAL '1 day'`);
    }
    if (q.search) {
      values.push(`%${q.search}%`);
      whereClauses.push(`(o.order_number ILIKE $${values.length} OR o.customer_name ILIKE $${values.length} OR o.customer_phone ILIKE $${values.length})`);
    }

    const [rows, count] = await Promise.all([
      pool.query(listOrdersAdminQuery(whereClauses, values.length + 1, values.length + 2), [...values, safeLimit, offset]),
      pool.query<{ count: number }>(countOrdersAdmin(whereClauses), values),
    ]);

    return success(res, rows.rows, "Orders fetched", 200, meta(count.rows[0].count));
  } catch (err) {
    next(err);
  }
};

export const getOrderDetailAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(findOrderDetailAdmin, [req.params.id]);
    if (!result.rows[0]) throw new AppError("NOT_FOUND", "Order not found", 404);

    const order = result.rows[0];
    if (order.invoice?.pdf_url) {
      order.invoice.pdf_url = await resolveInvoicePdfUrl(order.invoice.pdf_url);
    }

    return success(res, order);
  } catch (err) {
    next(err);
  }
};

export const updateOrderStatusAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, notes } = req.body;

    const existing = await pool.query(findOrderById, [req.params.id]);
    if (!existing.rows[0]) throw new AppError("NOT_FOUND", "Order not found", 404);
    assertValidStatusTransition(existing.rows[0].status, status);

    const result = await pool.query(updateOrderStatusAdminQuery, [req.params.id, status, notes ?? null]);
    await logOrderActivity(req.user!.id, "update_order_status", req.params.id, {
      description: notes ?? `Status changed to ${status}`,
      oldData: { status: existing.rows[0].status },
      newData: { status },
    });

    return success(res, result.rows[0], "Order status updated");
  } catch (err) {
    next(err);
  }
};

export const cancelOrderAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reason } = req.body;
    const { order, refundOutcome } = await cancelOrderWithRefund(
      req.params.id,
      reason ?? "Cancelled by admin",
      req.user!.id,
      { bypassTimeWindow: true }
    );
    return success(res, { ...order, refund_outcome: refundOutcome }, "Order cancelled");
  } catch (err) {
    next(err);
  }
};

export const getOrderActivity = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await pool.query(findOrderById, [req.params.id]);
    if (!existing.rows[0]) throw new AppError("NOT_FOUND", "Order not found", 404);
    const result = await pool.query(getOrderActivityQuery, [req.params.id]);
    return success(res, result.rows);
  } catch (err) {
    next(err);
  }
};

export const retryRefund = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orderResult = await pool.query(findOrderById, [req.params.id]);
    const order = orderResult.rows[0];
    if (!order) throw new AppError("NOT_FOUND", "Order not found", 404);
    if (order.status !== "refund_failed") {
      throw new AppError("VALIDATION_ERROR", `Order status is '${order.status}', expected 'refund_failed'`, 400);
    }

    const paymentResult = await pool.query(findLatestPaymentForOrder, [order.id]);
    const payment = paymentResult.rows[0];
    if (!payment || payment.status !== "captured") {
      throw new AppError("VALIDATION_ERROR", "No captured payment found to refund", 400);
    }

    try {
      const refund = await razorpay.payments.refund(payment.razorpay_payment_id, {
        amount: Math.round(Number(payment.amount) * 100),
      });
      await pool.query(markPaymentRefunded, [payment.id, Number(refund.amount) / 100, refund.id]);
      const updated = await pool.query(updateOrderStatus, [order.id, "refunded"]);
      await logOrderActivity(req.user!.id, "retry_refund_success", order.id, {
        description: "Manual refund retry succeeded",
      });
      return success(res, updated.rows[0], "Refund processed");
    } catch (err) {
      logger.error("Manual refund retry failed", { err, orderId: order.id, paymentId: payment.id });
      await logOrderActivity(req.user!.id, "retry_refund_failed", order.id, {
        description: "Manual refund retry failed again",
      });
      throw new AppError("PAYMENT_GATEWAY_ERROR", "Refund retry failed — check Razorpay dashboard", 502);
    }
  } catch (err) {
    next(err);
  }
};
