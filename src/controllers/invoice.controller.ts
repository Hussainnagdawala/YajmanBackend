import { Request, Response, NextFunction } from "express";
import { pool } from "../config/database";
import { success } from "../utils/response";
import { AppError } from "../utils/errors";
import { paginate } from "../utils/pagination";
import { findBookingDetail } from "../queries/booking.queries";
import {
  findInvoiceByOrderId,
  createInvoice,
  listInvoicesAdmin as listInvoicesAdminQuery,
  countInvoicesAdmin,
} from "../queries/invoice.queries";
import { generateInvoiceNumber, generateInvoicePdf, uploadInvoicePdf } from "../services/invoice.service";

export const getBookingInvoice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orderResult = await pool.query(findBookingDetail, [req.params.id]);
    const order = orderResult.rows[0];
    if (!order) throw new AppError("NOT_FOUND", "Booking not found", 404);
    if (req.user!.role !== "admin" && order.user_id !== req.user!.id) {
      throw new AppError("FORBIDDEN", "You do not have access to this booking", 403);
    }

    const existing = await pool.query(findInvoiceByOrderId, [order.id]);
    if (existing.rows[0]) {
      return success(res, { invoice_number: existing.rows[0].invoice_number, pdf_url: existing.rows[0].pdf_url });
    }

    const invoiceNumber = await generateInvoiceNumber();
    const invoiceData = {
      invoice_number: invoiceNumber,
      order: {
        order_number: order.order_number,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        customer_email: order.customer_email,
        booking_date: order.booking_date,
        booking_time: order.booking_time,
        address: order.address,
        city: order.city,
        pincode: order.pincode,
      },
      service_title: order.service_title,
      pricing: {
        base_price: Number(order.base_price),
        discount_amount: Number(order.discount_amount),
        convenience_fee: Number(order.convenience_fee),
        total_amount: Number(order.total_amount),
      },
      payment: {
        status: order.payment?.status ?? "pending",
        method: order.payment?.method ?? null,
        paid_at: order.payment?.paid_at ?? null,
      },
    };

    const pdfBuffer = await generateInvoicePdf(invoiceData);
    const pdfUrl = await uploadInvoicePdf(pdfBuffer, invoiceNumber);
    const invoice = await pool.query(createInvoice, [order.id, invoiceNumber, pdfUrl, JSON.stringify(invoiceData)]);

    return success(res, { invoice_number: invoice.rows[0].invoice_number, pdf_url: pdfUrl }, "Invoice generated", 201);
  } catch (err) {
    next(err);
  }
};

export const listInvoicesAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = req.query as unknown as { page?: string; limit?: string; from?: string; to?: string };
    const { limit: safeLimit, offset, meta } = paginate(Number(q.page) || 1, Number(q.limit) || 20);

    const values: unknown[] = [];
    const whereClauses: string[] = [];
    if (q.from) {
      values.push(q.from);
      whereClauses.push(`i.created_at >= $${values.length}`);
    }
    if (q.to) {
      values.push(q.to);
      whereClauses.push(`i.created_at <= $${values.length}::date + INTERVAL '1 day'`);
    }

    const [rows, count] = await Promise.all([
      pool.query(listInvoicesAdminQuery(whereClauses, values.length + 1, values.length + 2), [...values, safeLimit, offset]),
      pool.query<{ count: number }>(countInvoicesAdmin(whereClauses), values),
    ]);

    return success(res, rows.rows, "Invoices fetched", 200, meta(count.rows[0].count));
  } catch (err) {
    next(err);
  }
};
