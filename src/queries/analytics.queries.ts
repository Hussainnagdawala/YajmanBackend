export const insertAnalyticsEvent = `
  INSERT INTO analytics_events (entity_type, entity_id, event_type, user_id, visitor_hash, user_agent)
  VALUES ($1, $2, $3, $4, $5, $6)
`;

// ─── Per-entity aggregates (dashboard: top-by-views, service stats) ───────

export const NOT_REAL_BOOKING_SQL = "o.status NOT IN ('pending', 'payment_failed')";

// Views and orders are aggregated in their own subqueries BEFORE joining to
// services — joining both analytics_events and orders directly to services
// in one GROUP BY would fan out (every view row × every order row), silently
// inflating both counts.
export const topServicesByViews = (limitIdx: number) => `
  SELECT s.id, s.title, s.slug, s.feature_image_url, c.name AS category_name,
    COALESCE(v.views_count, 0)::int AS views_count,
    COALESCE(v.unique_visitors, 0)::int AS unique_visitors,
    COALESCE(o.bookings_count, 0)::int AS bookings_count,
    COALESCE(o.revenue, 0)::float AS revenue
  FROM services s
  JOIN categories c ON c.id = s.category_id
  LEFT JOIN (
    SELECT entity_id, COUNT(*) AS views_count, COUNT(DISTINCT visitor_hash) AS unique_visitors
    FROM analytics_events
    WHERE entity_type = 'service' AND created_at >= $1 AND created_at <= $2
    GROUP BY entity_id
  ) v ON v.entity_id = s.id
  LEFT JOIN (
    SELECT service_id,
      COUNT(*) FILTER (WHERE ${NOT_REAL_BOOKING_SQL}) AS bookings_count,
      SUM(total_amount) FILTER (WHERE ${NOT_REAL_BOOKING_SQL}) AS revenue
    FROM orders o
    WHERE created_at >= $1 AND created_at <= $2
    GROUP BY service_id
  ) o ON o.service_id = s.id
  ORDER BY views_count DESC
  LIMIT $${limitIdx}
`;

// Total views across every service in the period — the denominator for each
// service's "traffic share" (its views_count above ÷ this number).
export const totalServiceViewsInPeriod = `
  SELECT COUNT(*)::int AS total FROM analytics_events
  WHERE entity_type = 'service' AND created_at >= $1 AND created_at <= $2
`;

export const serviceViewStats = `
  SELECT
    COUNT(*)::int AS total_views,
    COUNT(DISTINCT visitor_hash)::int AS unique_visitors
  FROM analytics_events
  WHERE entity_type = 'service' AND entity_id = $1
`;

export const viewsTrend = `
  SELECT DATE_TRUNC($1, created_at) AS period_start, COUNT(*)::int AS value
  FROM analytics_events
  WHERE entity_type = 'service' AND created_at >= $2 AND created_at <= $3
  GROUP BY 1 ORDER BY 1
`;

// ─── Per-user visit history (admin: "what has this user been looking at") ─

export const userViewHistory = (limitIdx: number, offsetIdx: number) => `
  SELECT ae.id, ae.entity_type, ae.entity_id, ae.event_type, ae.created_at,
    COALESCE(s.title, ev.title, b.title) AS entity_title,
    COALESCE(s.slug, ev.slug, b.slug) AS entity_slug
  FROM analytics_events ae
  LEFT JOIN services s ON ae.entity_type = 'service' AND s.id = ae.entity_id
  LEFT JOIN aayojan_events ev ON ae.entity_type = 'aayojan_event' AND ev.id = ae.entity_id
  LEFT JOIN blogs b ON ae.entity_type = 'blog' AND b.id = ae.entity_id
  WHERE ae.user_id = $1
  ORDER BY ae.created_at DESC
  LIMIT $${limitIdx} OFFSET $${offsetIdx}
`;

export const countUserViewHistory = `SELECT COUNT(*)::int AS count FROM analytics_events WHERE user_id = $1`;

// Grouped "what this user looks at most" — same join pattern, aggregated.
export const userViewSummary = `
  SELECT ae.entity_type, ae.entity_id,
    COALESCE(s.title, ev.title, b.title) AS entity_title,
    COALESCE(s.slug, ev.slug, b.slug) AS entity_slug,
    COUNT(*)::int AS view_count,
    MAX(ae.created_at) AS last_viewed_at
  FROM analytics_events ae
  LEFT JOIN services s ON ae.entity_type = 'service' AND s.id = ae.entity_id
  LEFT JOIN aayojan_events ev ON ae.entity_type = 'aayojan_event' AND ev.id = ae.entity_id
  LEFT JOIN blogs b ON ae.entity_type = 'blog' AND b.id = ae.entity_id
  WHERE ae.user_id = $1
  GROUP BY ae.entity_type, ae.entity_id, s.title, ev.title, b.title, s.slug, ev.slug, b.slug
  ORDER BY view_count DESC, last_viewed_at DESC
  LIMIT 20
`;
