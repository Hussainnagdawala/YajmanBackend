// ─── Trends (time-series) ──────────────────────────────────────
// $1 = date_trunc field ('day'|'week'|'month'), $2 = from, $3 = to.
// period is always a server-side validated enum value (never raw user text
// spliced into the SQL) before it reaches these — still passed as a bind
// param, not interpolated, for defense in depth.

export const trendOrders = `
  SELECT DATE_TRUNC($1, created_at) AS period_start, COUNT(*)::int AS value
  FROM orders
  WHERE created_at >= $2 AND created_at <= $3
  GROUP BY 1 ORDER BY 1
`;

export const trendRevenue = `
  SELECT DATE_TRUNC($1, paid_at) AS period_start, COALESCE(SUM(amount), 0)::float AS value
  FROM payments
  WHERE status = 'captured' AND paid_at >= $2 AND paid_at <= $3
  GROUP BY 1 ORDER BY 1
`;

export const trendNewUsers = `
  SELECT DATE_TRUNC($1, created_at) AS period_start, COUNT(*)::int AS value
  FROM users
  WHERE role = 'customer' AND created_at >= $2 AND created_at <= $3
  GROUP BY 1 ORDER BY 1
`;

// ─── Top / leaderboard services ────────────────────────────────
// Orders in a 'pending'/'payment_failed' state never became real bookings —
// excluded from both the count and the revenue sum everywhere below.

const NOT_REAL_BOOKING = "o.status NOT IN ('pending', 'payment_failed')";

// Same shape regardless of sort order — a service's bookings/revenue/views
// are all useful together, so every leaderboard variant returns all of them;
// only ORDER BY changes. Views come from analytics_events (Phase 2), joined
// the same way regardless of which field is driving the sort.
export const topServicesByBookings = (limitIdx: number) => `
  SELECT s.id, s.title, s.slug, s.feature_image_url, c.name AS category_name,
    COUNT(o.id) FILTER (WHERE ${NOT_REAL_BOOKING})::int AS bookings_count,
    COALESCE(SUM(o.total_amount) FILTER (WHERE ${NOT_REAL_BOOKING}), 0)::float AS revenue,
    COALESCE(v.views_count, 0)::int AS views_count,
    COALESCE(v.unique_visitors, 0)::int AS unique_visitors
  FROM services s
  JOIN categories c ON c.id = s.category_id
  LEFT JOIN orders o ON o.service_id = s.id AND o.created_at >= $1 AND o.created_at <= $2
  LEFT JOIN (
    SELECT entity_id, COUNT(*) AS views_count, COUNT(DISTINCT visitor_hash) AS unique_visitors
    FROM analytics_events
    WHERE entity_type = 'service' AND created_at >= $1 AND created_at <= $2
    GROUP BY entity_id
  ) v ON v.entity_id = s.id
  GROUP BY s.id, c.name, v.views_count, v.unique_visitors
  ORDER BY bookings_count DESC, revenue DESC
  LIMIT $${limitIdx}
`;

export const topServicesByRevenue = (limitIdx: number) => `
  SELECT s.id, s.title, s.slug, s.feature_image_url, c.name AS category_name,
    COUNT(o.id) FILTER (WHERE ${NOT_REAL_BOOKING})::int AS bookings_count,
    COALESCE(SUM(o.total_amount) FILTER (WHERE ${NOT_REAL_BOOKING}), 0)::float AS revenue,
    COALESCE(v.views_count, 0)::int AS views_count,
    COALESCE(v.unique_visitors, 0)::int AS unique_visitors
  FROM services s
  JOIN categories c ON c.id = s.category_id
  LEFT JOIN orders o ON o.service_id = s.id AND o.created_at >= $1 AND o.created_at <= $2
  LEFT JOIN (
    SELECT entity_id, COUNT(*) AS views_count, COUNT(DISTINCT visitor_hash) AS unique_visitors
    FROM analytics_events
    WHERE entity_type = 'service' AND created_at >= $1 AND created_at <= $2
    GROUP BY entity_id
  ) v ON v.entity_id = s.id
  GROUP BY s.id, c.name, v.views_count, v.unique_visitors
  ORDER BY revenue DESC, bookings_count DESC
  LIMIT $${limitIdx}
`;

// ─── Single-service deep dive ──────────────────────────────────

export const serviceStatsById = `
  SELECT
    s.id, s.title, s.slug, s.rating_avg, s.total_reviews,
    COUNT(o.id)::int AS total_bookings,
    COUNT(o.id) FILTER (WHERE o.status = 'completed')::int AS completed_bookings,
    COUNT(o.id) FILTER (WHERE o.status IN ('cancelled', 'refunded', 'refund_failed'))::int AS cancelled_bookings,
    COALESCE(SUM(o.total_amount) FILTER (WHERE ${NOT_REAL_BOOKING}), 0)::float AS total_revenue,
    COALESCE(AVG(o.total_amount) FILTER (WHERE ${NOT_REAL_BOOKING}), 0)::float AS avg_order_value
  FROM services s
  LEFT JOIN orders o ON o.service_id = s.id
  WHERE s.id = $1
  GROUP BY s.id
`;

// ─── Pandit performance leaderboard ─────────────────────────────

export const panditPerformance = (limitIdx: number) => `
  SELECT pp.id, pp.display_name, pp.rating_avg, pp.total_reviews, u.phone,
    COUNT(pa.id)::int AS total_assignments,
    COUNT(pa.id) FILTER (WHERE pa.status = 'accepted')::int AS accepted_count,
    COUNT(pa.id) FILTER (WHERE pa.status = 'rejected')::int AS rejected_count,
    COUNT(pa.id) FILTER (WHERE pa.status = 'expired')::int AS expired_count,
    COUNT(pa.id) FILTER (WHERE pa.status = 'completed')::int AS completed_count,
    ROUND(
      (COUNT(pa.id) FILTER (WHERE pa.status IN ('accepted', 'completed')))::numeric
      / NULLIF(COUNT(pa.id), 0), 2
    ) AS acceptance_rate,
    ROUND(
      AVG(EXTRACT(EPOCH FROM (pa.accepted_at - pa.assigned_at)) / 3600.0)
      FILTER (WHERE pa.accepted_at IS NOT NULL)::numeric, 1
    ) AS avg_response_hours
  FROM pandit_profiles pp
  JOIN users u ON u.id = pp.user_id
  LEFT JOIN pandit_assignments pa ON pa.pandit_id = pp.id
  GROUP BY pp.id, u.phone
  ORDER BY completed_count DESC, pp.rating_avg DESC
  LIMIT $${limitIdx}
`;

// ─── Category-wise breakdown ────────────────────────────────────

export const categoryBreakdown = `
  SELECT c.id, c.name, c.slug, c.requires_pandit, c.requires_payment, c.requires_booking_time,
    COUNT(DISTINCT s.id)::int AS services_count,
    COUNT(o.id) FILTER (WHERE ${NOT_REAL_BOOKING})::int AS bookings_count,
    COALESCE(SUM(o.total_amount) FILTER (WHERE ${NOT_REAL_BOOKING}), 0)::float AS revenue
  FROM categories c
  LEFT JOIN services s ON s.category_id = c.id
  LEFT JOIN orders o ON o.service_id = s.id
  GROUP BY c.id
  ORDER BY revenue DESC
`;

// ─── Coupon performance ─────────────────────────────────────────

export const topCoupons = (limitIdx: number) => `
  SELECT c.id, c.code, c.title, c.usage_count, c.is_active,
    COALESCE(SUM(o.discount_amount) FILTER (WHERE ${NOT_REAL_BOOKING}), 0)::float AS total_discount_given
  FROM coupons c
  LEFT JOIN orders o ON o.coupon_id = c.id
  GROUP BY c.id
  ORDER BY c.usage_count DESC
  LIMIT $${limitIdx}
`;
