import { Request, Response, NextFunction } from "express";
import { pool } from "../config/database";
import { success } from "../utils/response";
import { AppError } from "../utils/errors";
import { paginate } from "../utils/pagination";
import { findBookingDetail } from "../queries/booking.queries";
import {
  listInvoicesAdmin as listInvoicesAdminQuery,
  countInvoicesAdmin,
} from "../queries/invoice.queries";
import { ensureOrderInvoice, resolveInvoicePdfUrl } from "../services/invoice.service";

export const getBookingInvoice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orderResult = await pool.query(findBookingDetail, [req.params.id]);
    const order = orderResult.rows[0];
    if (!order) throw new AppError("NOT_FOUND", "Booking not found", 404);
    if (req.user!.role !== "admin" && order.user_id !== req.user!.id) {
      throw new AppError("FORBIDDEN", "You do not have access to this booking", 403);
    }

    const invoice = await ensureOrderInvoice(order.id);
    return success(
      res,
      { invoice_number: invoice.invoice_number, pdf_url: invoice.download_pdf_url },
      invoice.created ? "Invoice generated" : undefined,
      invoice.created ? 201 : 200
    );
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

    const invoices = await Promise.all(
      rows.rows.map(async (row) => ({
        ...row,
        pdf_url: await resolveInvoicePdfUrl(row.pdf_url),
      }))
    );

    return success(res, invoices, "Invoices fetched", 200, meta(count.rows[0].count));
  } catch (err) {
    next(err);
  }
};
