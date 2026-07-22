export const listAllCoupons = `SELECT * FROM coupons ORDER BY created_at DESC`;

export const findCouponById = `SELECT * FROM coupons WHERE id = $1`;

export const findCouponByCode = `SELECT * FROM coupons WHERE code = $1`;

export const createCoupon = `
  INSERT INTO coupons (
    code, title, description, discount_type, discount_value, max_discount_amount,
    min_order_amount, usage_limit, per_user_limit, valid_from, valid_until,
    applicable_categories, applicable_services, created_by
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
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

export const findServiceForCoupon = `SELECT id, category_id FROM services WHERE id = $1`;

export const countUserCouponUsage = `
  SELECT COUNT(*)::int AS count FROM coupon_usages WHERE coupon_id = $1 AND user_id = $2
`;

export const insertCouponUsage = `
  INSERT INTO coupon_usages (coupon_id, user_id, order_id) VALUES ($1, $2, $3)
`;

export const incrementCouponUsageCount = `
  UPDATE coupons SET usage_count = usage_count + 1 WHERE id = $1
`;
