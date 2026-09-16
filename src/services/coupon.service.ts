import { pool } from "../config/database";
import { findCouponByCode, findServiceForCoupon, countUserCouponUsage, findPaidServiceIds } from "../queries/coupon.queries";
import { AppError } from "../utils/errors";

export interface CouponRow {
  id: string;
  code: string;
  title: string;
  discount_type: "percentage" | "fixed";
  discount_value: string;
  max_discount_amount: string | null;
  min_order_amount: string;
  usage_limit: number | null;
  usage_count: number;
  per_user_limit: number;
  valid_from: string;
  valid_until: string;
  applicable_services: string[] | null;
  is_active: boolean;
}

export interface CouponValidationResult {
  valid: boolean;
  message?: string;
  discount_amount?: number;
  final_amount?: number;
  coupon?: { id: string; code: string; title: string };
}

export const assertPaidServiceIds = async (serviceIds: string[]): Promise<void> => {
  const unique = [...new Set(serviceIds)];
  const result = await pool.query<{ id: string }>(findPaidServiceIds, [unique]);
  if (result.rows.length !== unique.length) {
    throw new AppError("VALIDATION_ERROR", "Coupons can only be applied to paid services", 400, [
      { field: "applicable_services", message: "Select only services whose category requires payment" },
    ]);
  }
};

export const validateCoupon = async (
  code: string,
  userId: string,
  amount: number,
  serviceId: string
): Promise<CouponValidationResult> => {
  const result = await pool.query<CouponRow>(findCouponByCode, [code.trim().toUpperCase()]);
  const coupon = result.rows[0];

  if (!coupon) return { valid: false, message: "Coupon not found" };
  if (!coupon.is_active) return { valid: false, message: "Coupon is inactive" };

  const now = new Date();
  if (now < new Date(coupon.valid_from)) return { valid: false, message: "Coupon is not yet valid" };
  if (now > new Date(coupon.valid_until)) return { valid: false, message: "Coupon has expired" };

  if (coupon.usage_limit !== null && coupon.usage_count >= coupon.usage_limit) {
    return { valid: false, message: "Coupon usage limit reached" };
  }

  const userUsage = await pool.query<{ count: number }>(countUserCouponUsage, [coupon.id, userId]);
  if (userUsage.rows[0].count >= coupon.per_user_limit) {
    return { valid: false, message: "You have already used this coupon the maximum number of times" };
  }

  const minOrderAmount = Number(coupon.min_order_amount);
  if (amount < minOrderAmount) {
    return { valid: false, message: `Minimum order amount of ${minOrderAmount} not met` };
  }

  const serviceResult = await pool.query<{ id: string; requires_payment: boolean }>(findServiceForCoupon, [serviceId]);
  const service = serviceResult.rows[0];
  if (!service) return { valid: false, message: "Service not found" };
  if (!service.requires_payment) {
    return { valid: false, message: "Coupons cannot be applied to this service" };
  }

  const assigned = coupon.applicable_services ?? [];
  if (assigned.length === 0 || !assigned.includes(service.id)) {
    return { valid: false, message: "Coupon is not applicable to this service" };
  }

  const discountValue = Number(coupon.discount_value);
  let discountAmount =
    coupon.discount_type === "percentage" ? (amount * discountValue) / 100 : discountValue;

  if (coupon.max_discount_amount !== null) {
    discountAmount = Math.min(discountAmount, Number(coupon.max_discount_amount));
  }
  discountAmount = Math.min(discountAmount, amount);
  discountAmount = Math.round(discountAmount * 100) / 100;

  return {
    valid: true,
    discount_amount: discountAmount,
    final_amount: Math.round((amount - discountAmount) * 100) / 100,
    coupon: { id: coupon.id, code: coupon.code, title: coupon.title },
  };
};
