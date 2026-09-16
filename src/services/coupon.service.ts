import { pool } from "../config/database";
import { findCouponByCode, findServiceForCoupon, countUserCouponUsage } from "../queries/coupon.queries";

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
  applicable_categories: string[] | null;
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

export const validateCoupon = async (
  code: string,
  userId: string,
  amount: number,
  serviceId?: string
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

  const hasServiceRestriction = coupon.applicable_services && coupon.applicable_services.length > 0;
  const hasCategoryRestriction = coupon.applicable_categories && coupon.applicable_categories.length > 0;

  if (hasServiceRestriction || hasCategoryRestriction) {
    if (!serviceId) return { valid: false, message: "Coupon is not applicable to this order" };

    const serviceResult = await pool.query<{ id: string; category_id: string }>(findServiceForCoupon, [serviceId]);
    const service = serviceResult.rows[0];
    if (!service) return { valid: false, message: "Service not found" };

    const serviceMatches = hasServiceRestriction && coupon.applicable_services!.includes(service.id);
    const categoryMatches = hasCategoryRestriction && coupon.applicable_categories!.includes(service.category_id);

    if (hasServiceRestriction && !hasCategoryRestriction && !serviceMatches) {
      return { valid: false, message: "Coupon is not applicable to this service" };
    }
    if (hasCategoryRestriction && !hasServiceRestriction && !categoryMatches) {
      return { valid: false, message: "Coupon is not applicable to this service's category" };
    }
    if (hasServiceRestriction && hasCategoryRestriction && !serviceMatches && !categoryMatches) {
      return { valid: false, message: "Coupon is not applicable to this service" };
    }
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
