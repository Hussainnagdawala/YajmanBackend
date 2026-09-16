const whereSql = (clauses: string[]): string => (clauses.length ? `WHERE ${clauses.join(" AND ")}` : "");

export const exportOrdersAdmin = (whereClauses: string[], limitIdx: number) => `
  SELECT o.order_number, o.customer_name, o.customer_phone, o.customer_email,
    s.title AS service_title, o.booking_date, o.booking_time,
    o.base_price, o.discount_amount, o.convenience_fee, o.total_amount,
    o.status, o.city, o.state, o.pincode, o.coupon_code, o.address,
    o.created_at,
    (
      SELECT pa.status FROM pandit_assignments pa
      WHERE pa.order_id = o.id ORDER BY pa.assigned_at DESC LIMIT 1
    ) AS assignment_status
  FROM orders o
  JOIN services s ON s.id = o.service_id
  ${whereSql(whereClauses)}
  ORDER BY o.created_at DESC
  LIMIT $${limitIdx}
`;

export const exportUsers = (whereClauses: string[], limitIdx: number) => `
  SELECT name, phone, email, role, status, country_code, created_at, last_login_at
  FROM users
  ${whereSql(whereClauses)}
  ORDER BY created_at DESC
  LIMIT $${limitIdx}
`;

export const exportPanditsAdmin = (whereClauses: string[], limitIdx: number) => `
  SELECT pp.display_name, u.phone, u.email, u.status AS user_status,
    pp.experience_years, pp.rating_avg AS rating, pp.is_available, pp.is_verified,
    pp.service_areas, pp.languages, pp.specializations, pp.created_at
  FROM pandit_profiles pp
  JOIN users u ON u.id = pp.user_id
  ${whereSql(whereClauses)}
  ORDER BY pp.created_at DESC
  LIMIT $${limitIdx}
`;

export const exportAssignmentsAdmin = (whereClauses: string[], limitIdx: number) => `
  SELECT o.order_number, pp.display_name AS pandit_name, u.phone AS pandit_phone,
    pa.status, o.booking_date, o.booking_time, pa.assigned_at, pa.respond_by,
    pa.accepted_at, pa.rejected_at
  FROM pandit_assignments pa
  JOIN orders o ON o.id = pa.order_id
  JOIN pandit_profiles pp ON pp.id = pa.pandit_id
  JOIN users u ON u.id = pp.user_id
  ${whereSql(whereClauses)}
  ORDER BY pa.assigned_at DESC
  LIMIT $${limitIdx}
`;

export const exportServicesAdmin = (whereClauses: string[], orderBy: string, limitIdx: number) => `
  SELECT s.title, c.name AS category_name, s.price, s.original_price, s.status,
    s.is_active, s.is_bestseller, s.is_featured, c.requires_pandit, c.requires_payment,
    s.duration_minutes, s.created_at
  FROM services s
  JOIN categories c ON c.id = s.category_id
  ${whereSql(whereClauses)}
  ORDER BY ${orderBy}
  LIMIT $${limitIdx}
`;

export const exportCategories = (limitIdx: number) => `
  SELECT name, slug, display_order, is_active, requires_pandit, requires_payment,
    requires_booking_time, created_at
  FROM categories
  ORDER BY display_order, name
  LIMIT $${limitIdx}
`;

export const exportCoupons = (limitIdx: number) => `
  SELECT code, title, description, discount_type, discount_value, min_order_amount,
    max_discount_amount, usage_limit, usage_count, is_active, valid_from, valid_until, created_at
  FROM coupons
  ORDER BY created_at DESC
  LIMIT $${limitIdx}
`;

export const exportContactEntries = (whereClauses: string[], limitIdx: number) => `
  SELECT form_type, name, email, phone, city, message, service_name, category_name,
    event_name, number_of_people, preferred_date, status, created_at
  FROM contact_form_entries
  ${whereSql(whereClauses)}
  ORDER BY created_at DESC
  LIMIT $${limitIdx}
`;

export const exportInvoicesAdmin = (whereClauses: string[], limitIdx: number) => `
  SELECT i.invoice_number, o.order_number, o.customer_name, o.total_amount, i.created_at
  FROM invoices i
  JOIN orders o ON o.id = i.order_id
  ${whereSql(whereClauses)}
  ORDER BY i.created_at DESC
  LIMIT $${limitIdx}
`;

export const exportAayojanContent = (limitIdx: number) => `
  SELECT section_key, title, subtitle, cta_text, cta_link, display_order, is_active, updated_at
  FROM aayojan_page_content
  ORDER BY display_order
  LIMIT $${limitIdx}
`;

export const exportAayojanEvents = (limitIdx: number) => `
  SELECT title, slug, location, city, event_date, event_time, price, original_price,
    max_capacity, status, is_active, created_at
  FROM aayojan_events
  ORDER BY created_at DESC
  LIMIT $${limitIdx}
`;

export const exportAayojanBanners = (limitIdx: number) => `
  SELECT title, link_url, display_order, is_active, created_at
  FROM aayojan_banners
  ORDER BY display_order
  LIMIT $${limitIdx}
`;

export const exportAayojanGallery = (limitIdx: number) => `
  SELECT image_url, display_order, is_active, created_at
  FROM aayojan_gallery_images
  ORDER BY display_order
  LIMIT $${limitIdx}
`;

export const countExportRows = (baseFrom: string, whereClauses: string[]) => `
  SELECT COUNT(*)::int AS count FROM ${baseFrom}
  ${whereSql(whereClauses)}
`;
