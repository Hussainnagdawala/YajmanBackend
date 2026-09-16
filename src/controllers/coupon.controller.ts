import { Request, Response, NextFunction } from "express";
import { pool } from "../config/database";
import { success } from "../utils/response";
import { AppError } from "../utils/errors";
import { assertPaidServiceIds, validateCoupon } from "../services/coupon.service";
import {
  listAllCoupons,
  listActiveCoupons,
  listActiveCouponsForService,
  findServiceForCoupon,
  createCoupon as createCouponQuery,
  updateCoupon as updateCouponQuery,
  softDeleteCoupon,
  hardDeleteCoupon,
  countCouponUsagesByCoupon,
  countOrdersByCoupon,
} from "../queries/coupon.queries";
import { findActiveServiceById } from "../queries/service.queries";
import { resolveCheckoutQuantity, serviceLineTotal } from "../utils/service-quantity";

export const listCouponsAdmin = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(listAllCoupons);
    return success(res, result.rows);
  } catch (err) {
    next(err);
  }
};

/** App-facing: active + currently valid coupons only. Pass service_id to filter to that paid service. */
export const listCoupons = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const serviceId = (req.query as { service_id?: string }).service_id;
    if (serviceId) {
      const serviceResult = await pool.query<{ requires_payment: boolean }>(findServiceForCoupon, [serviceId]);
      if (!serviceResult.rows[0]?.requires_payment) {
        return success(res, []);
      }
      const result = await pool.query(listActiveCouponsForService, [serviceId]);
      return success(res, result.rows);
    }
    const result = await pool.query(listActiveCoupons);
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
      applicable_services,
    } = req.body;

    await assertPaidServiceIds(applicable_services);

    const result = await pool.query(createCouponQuery, [
      code, title, description ?? null, discount_type, discount_value, max_discount_amount ?? null,
      min_order_amount, usage_limit ?? null, per_user_limit, valid_from, valid_until,
      applicable_services, req.user!.id,
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

    if (Array.isArray(req.body.applicable_services)) {
      await assertPaidServiceIds(req.body.applicable_services);
    }

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
    const { code, service_id, quantity } = req.body;
    const serviceResult = await pool.query(findActiveServiceById, [service_id]);
    const service = serviceResult.rows[0];
    if (!service) throw new AppError("NOT_FOUND", "Service not found or not available for booking", 404);
    if (!service.requires_payment) {
      throw new AppError("VALIDATION_ERROR", "Coupons cannot be applied to this service", 400);
    }
    const qty = resolveCheckoutQuantity(service, quantity);
    const amount = serviceLineTotal(Number(service.price), qty);
    const result = await validateCoupon(code, req.user!.id, amount, service_id);
    return success(res, result);
  } catch (err) {
    next(err);
  }
};
