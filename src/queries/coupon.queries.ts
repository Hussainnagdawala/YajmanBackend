export const listAllCoupons = `SELECT * FROM coupons ORDER BY created_at DESC`;

/** Active coupons currently within validity window — for app checkout / offers UI. */
export const listActiveCoupons = `
  SELECT
    id, code, title, description, discount_type, discount_value,
    max_discount_amount, min_order_amount, usage_limit, usage_count,
    per_user_limit, valid_from, valid_until,
    applicable_services
  FROM coupons
  WHERE is_active = true
    AND valid_from <= NOW()
    AND valid_until >= NOW()
    AND (usage_limit IS NULL OR usage_count < usage_limit)
  ORDER BY valid_until ASC, created_at DESC
`;

export const listActiveCouponsForService = `
  SELECT
    id, code, title, description, discount_type, discount_value,
    max_discount_amount, min_order_amount, usage_limit, usage_count,
    per_user_limit, valid_from, valid_until,
    applicable_services
  FROM coupons
  WHERE is_active = true
    AND valid_from <= NOW()
    AND valid_until >= NOW()
    AND (usage_limit IS NULL OR usage_count < usage_limit)
    AND $1::uuid = ANY(applicable_services)
  ORDER BY valid_until ASC, created_at DESC
`;

export const findCouponById = `SELECT * FROM coupons WHERE id = $1`;

export const findCouponByCode = `SELECT * FROM coupons WHERE code = $1`;

export const createCoupon = `
  INSERT INTO coupons (
    code, title, description, discount_type, discount_value, max_discount_amount,
    min_order_amount, usage_limit, per_user_limit, valid_from, valid_until,
    applicable_categories, applicable_services, created_by
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NULL, $12, $13)
  RETURNING *
`;

export const updateCoupon = (fields: string[]) => `
  UPDATE coupons SET ${fields.map((f, i) => `${f} = $${i + 2}`).join(", ")}, updated_at = NOW()
  WHERE id = $1
  RETURNING *
`;

export const softDeleteCoupon = `
  UPDATE coupons SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *
`;
export const hardDeleteCoupon = `DELETE FROM coupons WHERE id = $1 RETURNING *`;
export const countCouponUsagesByCoupon = `SELECT COUNT(*)::int AS count FROM coupon_usages WHERE coupon_id = $1`;
export const countOrdersByCoupon = `SELECT COUNT(*)::int AS count FROM orders WHERE coupon_id = $1`;

export const findServiceForCoupon = `
  SELECT s.id, s.category_id, c.requires_payment
  FROM services s
  JOIN categories c ON c.id = s.category_id
  WHERE s.id = $1
`;

export const findPaidServiceIds = `
  SELECT s.id
  FROM services s
  JOIN categories c ON c.id = s.category_id
  WHERE s.id = ANY($1::uuid[]) AND c.requires_payment = true
`;

export const countUserCouponUsage = `
  SELECT COUNT(*)::int AS count FROM coupon_usages WHERE coupon_id = $1 AND user_id = $2
`;

export const insertCouponUsage = `
  INSERT INTO coupon_usages (coupon_id, user_id, order_id) VALUES ($1, $2, $3)
`;

export const incrementCouponUsageCount = `
  UPDATE coupons SET usage_count = usage_count + 1 WHERE id = $1
`;

// Reverse of the two above — called when a captured, coupon-discounted
// order actually gets refunded, so the usage slot becomes available again
// instead of being permanently burned by a cancelled booking.
export const deleteCouponUsage = `
  DELETE FROM coupon_usages WHERE order_id = $1
`;

export const decrementCouponUsageCount = `
  UPDATE coupons SET usage_count = GREATEST(usage_count - 1, 0) WHERE id = $1
`;
