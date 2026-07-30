import { Request, Response, NextFunction } from "express";
import { pool } from "../config/database";
import { success } from "../utils/response";
import { AppError } from "../utils/errors";
import { validateCoupon } from "../services/coupon.service";
import {
  listAllCoupons,
  createCoupon as createCouponQuery,
  updateCoupon as updateCouponQuery,
  softDeleteCoupon,
  hardDeleteCoupon,
  countCouponUsagesByCoupon,
  countOrdersByCoupon,
} from "../queries/coupon.queries";

export const listCouponsAdmin = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(listAllCoupons);
    return success(res, result.rows);
  } catch (err) {
    next(err);
  }
};

export const createCoupon = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      code, title, description, discount_type, discount_value, max_discount_amount,
      min_order_amount, usage_limit, per_user_limit, valid_from, valid_until,
      applicable_categories, applicable_services,
    } = req.body;

    const result = await pool.query(createCouponQuery, [
      code, title, description ?? null, discount_type, discount_value, max_discount_amount ?? null,
      min_order_amount, usage_limit ?? null, per_user_limit, valid_from, valid_until,
      applicable_categories ?? null, applicable_services ?? null, req.user!.id,
    ]);
    return success(res, result.rows[0], "Coupon created", 201);
  } catch (err) {
    next(err);
  }
};

export const updateCoupon = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fields = Object.keys(req.body);
    if (fields.length === 0) throw new AppError("VALIDATION_ERROR", "No fields to update", 400);

    const values = fields.map((f) => req.body[f]);
    const result = await pool.query(updateCouponQuery(fields), [req.params.id, ...values]);
    if (!result.rows[0]) throw new AppError("NOT_FOUND", "Coupon not found", 404);
    return success(res, result.rows[0], "Coupon updated");
  } catch (err) {
    next(err);
  }
};

export const deleteCoupon = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(softDeleteCoupon, [req.params.id]);
    if (!result.rows[0]) throw new AppError("NOT_FOUND", "Coupon not found", 404);
    return success(res, result.rows[0], "Coupon deleted");
  } catch (err) {
    next(err);
  }
};

export const deleteCouponPermanently = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [usages, orders] = await Promise.all([
      pool.query<{ count: number }>(countCouponUsagesByCoupon, [req.params.id]),
      pool.query<{ count: number }>(countOrdersByCoupon, [req.params.id]),
    ]);
    if (usages.rows[0].count > 0 || orders.rows[0].count > 0) {
      throw new AppError("CONFLICT", "Cannot delete coupon with linked usage or orders", 409);
    }
    const result = await pool.query(hardDeleteCoupon, [req.params.id]);
    if (!result.rows[0]) throw new AppError("NOT_FOUND", "Coupon not found", 404);
    return success(res, result.rows[0], "Coupon permanently deleted");
  } catch (err) {
    next(err);
  }
};

export const validateCouponHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, service_id, amount } = req.body;
    const result = await validateCoupon(code, req.user!.id, amount, service_id);
    return success(res, result);
  } catch (err) {
    next(err);
  }
};
