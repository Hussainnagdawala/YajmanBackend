export const countOrdersToday = `
  SELECT COUNT(*)::int AS count FROM orders WHERE created_at::date = CURRENT_DATE
`;

export const findDuplicateBooking = `
  SELECT id FROM orders
  WHERE user_id = $1 AND service_id = $2 AND booking_date = $3
    AND status NOT IN ('cancelled', 'refunded')
`;

export const createOrder = `
  INSERT INTO orders (
    order_number, user_id, service_id, customer_name, customer_phone, customer_whatsapp,
    customer_calling_number, customer_email, gotra, gotra_unknown, booking_date, booking_time,
    booking_datetime, address, city, pincode, base_price, discount_amount, convenience_fee,
    total_amount, coupon_id, coupon_code, birth_date, birth_time, birth_place, special_instructions
  ) VALUES (
    $1, $2, $3, $4, $5, $6,
    $7, $8, $9, $10, $11, $12,
    $13, $14, $15, $16, $17, $18, $19,
    $20, $21, $22, $23, $24, $25, $26
  )
  RETURNING *
`;

export const insertOrderMember = `
  INSERT INTO order_members (order_id, name, display_order)
  VALUES ($1, $2, $3)
`;

export const findOrderById = `SELECT * FROM orders WHERE id = $1`;

export const updateOrderStatus = `
  UPDATE orders SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *
`;

export const getAppSettingByKey = `SELECT value FROM app_settings WHERE key = $1`;
