export const countOrdersToday = `
  SELECT COUNT(*)::int AS count FROM orders WHERE created_at::date = CURRENT_DATE
`;

export const findDuplicateBooking = `
  SELECT id FROM orders
  WHERE user_id = $1 AND service_id = $2 AND booking_date = $3
    AND status NOT IN ('cancelled', 'refunded', 'payment_failed', 'refund_failed')
`;

export const createOrder = `
  INSERT INTO orders (
    order_number, user_id, service_id, customer_name, customer_phone, customer_whatsapp,
    customer_calling_number, customer_email, gotra, gotra_unknown, booking_date, booking_time,
    booking_datetime, address, city, pincode, base_price, discount_amount, convenience_fee,
    total_amount, coupon_id, coupon_code, birth_date, birth_time, birth_place, special_instructions,
    addon_total
  ) VALUES (
    $1, $2, $3, $4, $5, $6,
    $7, $8, $9, $10, $11, $12,
    $13, $14, $15, $16, $17, $18, $19,
    $20, $21, $22, $23, $24, $25, $26,
    $27
  )
  RETURNING *
`;

export const insertOrderMember = `
  INSERT INTO order_members (order_id, name, display_order)
  VALUES ($1, $2, $3)
`;

export const insertOrderAddon = `
  INSERT INTO order_addons (order_id, addon_id, name, price)
  VALUES ($1, $2, $3, $4)
`;

export const findOrderById = `SELECT * FROM orders WHERE id = $1`;

export const updateOrderStatus = `
  UPDATE orders SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *
`;

export const getAppSettingByKey = `SELECT value FROM app_settings WHERE key = $1`;

export const completeOrder = `
  UPDATE orders SET status = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *
`;

// ─── Admin: order management ─────────────────────────────────

export const listOrdersAdmin = (whereClauses: string[], limitIdx: number, offsetIdx: number) => `
  SELECT o.*, s.title AS service_title, s.slug AS service_slug
  FROM orders o
  JOIN services s ON s.id = o.service_id
  ${whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : ""}
  ORDER BY o.created_at DESC
  LIMIT $${limitIdx} OFFSET $${offsetIdx}
`;

export const countOrdersAdmin = (whereClauses: string[]) => `
  SELECT COUNT(*)::int AS count
  FROM orders o
  JOIN services s ON s.id = o.service_id
  ${whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : ""}
`;

export const findOrderDetailAdmin = `
  SELECT o.*,
    s.title AS service_title, s.slug AS service_slug,
    COALESCE(
      (SELECT json_agg(om.name ORDER BY om.display_order) FROM order_members om WHERE om.order_id = o.id), '[]'
    ) AS members,
    COALESCE(
      (SELECT json_agg(jsonb_build_object('id', oa.id, 'name', oa.name, 'price', oa.price)) FROM order_addons oa WHERE oa.order_id = o.id), '[]'
    ) AS addons,
    (
      SELECT jsonb_build_object('id', pm.id, 'status', pm.status, 'method', pm.method, 'paid_at', pm.paid_at, 'amount', pm.amount)
      FROM payments pm WHERE pm.order_id = o.id ORDER BY pm.created_at DESC LIMIT 1
    ) AS payment,
    (
      SELECT jsonb_build_object('id', pa.id, 'status', pa.status, 'display_name', pp.display_name, 'phone', u.phone)
      FROM pandit_assignments pa
      JOIN pandit_profiles pp ON pp.id = pa.pandit_id
      JOIN users u ON u.id = pp.user_id
      WHERE pa.order_id = o.id ORDER BY pa.assigned_at DESC LIMIT 1
    ) AS assignment,
    (
      SELECT jsonb_build_object('invoice_number', i.invoice_number, 'pdf_url', i.pdf_url)
      FROM invoices i WHERE i.order_id = o.id LIMIT 1
    ) AS invoice,
    (
      SELECT jsonb_build_object('id', r.id, 'rating', r.rating, 'title', r.title, 'comment', r.comment)
      FROM reviews r WHERE r.booking_id = o.id LIMIT 1
    ) AS review
  FROM orders o
  JOIN services s ON s.id = o.service_id
  WHERE o.id = $1
`;

export const updateOrderStatusAdmin = `
  UPDATE orders SET status = $2, admin_notes = COALESCE($3, admin_notes), updated_at = NOW()
  WHERE id = $1
  RETURNING *
`;

// Bulk-expires checkout attempts nobody ever completed payment for — run by
// the order-expiry cron. Excludes 'created' payments too since a Razorpay
// order was opened but never paid.
export const expireStalePendingOrders = `
  UPDATE orders SET status = 'payment_failed', updated_at = NOW()
  WHERE status = 'pending' AND created_at < NOW() - INTERVAL '30 minutes'
  RETURNING id
`;

export const markStalePaymentsFailed = `
  UPDATE payments SET
    status = 'failed', error_code = 'EXPIRED',
    error_description = 'Payment window expired', error_reason = 'timeout',
    updated_at = NOW()
  WHERE order_id = ANY($1::uuid[]) AND status IN ('pending', 'created')
  RETURNING id
`;

export const getOrderActivity = `
  SELECT id, entity_id AS order_id, action AS event, new_data->>'description' AS description, created_at
  FROM activity_logs
  WHERE entity_type = 'order' AND entity_id = $1
  ORDER BY created_at DESC
`;

// ─── Admin: dashboard ─────────────────────────────────────────

export const dashboardTotalOrders = `SELECT COUNT(*)::int AS count FROM orders`;

export const dashboardTotalRevenue = `
  SELECT COALESCE(SUM(amount), 0)::float AS total FROM payments WHERE status = 'captured'
`;

export const dashboardPendingOrders = `
  SELECT COUNT(*)::int AS count FROM orders WHERE status IN ('pending', 'confirmed', 'pandit_assigned', 'in_progress')
`;

export const dashboardActivePandits = `
  SELECT COUNT(*)::int AS count FROM users WHERE role = 'pandit' AND status = 'active'
`;

export const dashboardOrdersToday = `
  SELECT COUNT(*)::int AS count FROM orders WHERE created_at::date = CURRENT_DATE
`;

export const dashboardRevenueToday = `
  SELECT COALESCE(SUM(amount), 0)::float AS total FROM payments WHERE status = 'captured' AND paid_at::date = CURRENT_DATE
`;

export const dashboardRecentOrders = `
  SELECT o.id, o.order_number, o.customer_name, o.total_amount, o.status, o.created_at, s.title AS service_title
  FROM orders o
  JOIN services s ON s.id = o.service_id
  ORDER BY o.created_at DESC
  LIMIT 10
`;

export const dashboardPendingAssignments = `
  SELECT pa.id, pa.respond_by, o.order_number, pp.display_name AS pandit_name
  FROM pandit_assignments pa
  JOIN orders o ON o.id = pa.order_id
  JOIN pandit_profiles pp ON pp.id = pa.pandit_id
  WHERE pa.status = 'pending'
  ORDER BY pa.respond_by
  LIMIT 10
`;
