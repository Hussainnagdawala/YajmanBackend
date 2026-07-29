// ─── Popular searches ────────────────────────────────────────

export const listActivePopularSearches = `
  SELECT * FROM popular_searches WHERE is_active = true ORDER BY row_number, display_order
`;
export const listAllPopularSearches = `SELECT * FROM popular_searches ORDER BY row_number, display_order`;
export const createPopularSearch = `
  INSERT INTO popular_searches (label, link_url, display_order, row_number)
  VALUES ($1, $2, $3, $4)
  RETURNING *
`;
export const updatePopularSearch = (fields: string[]) => `
  UPDATE popular_searches SET ${fields.map((f, i) => `${f} = $${i + 2}`).join(", ")}
  WHERE id = $1
  RETURNING *
`;
export const softDeletePopularSearch = `UPDATE popular_searches SET is_active = false WHERE id = $1 RETURNING *`;

// ─── Banners ─────────────────────────────────────────────────

export const listActiveBannersByPosition = `
  SELECT * FROM banners
  WHERE position = $1 AND is_active = true
    AND (starts_at IS NULL OR starts_at <= NOW())
    AND (ends_at IS NULL OR ends_at >= NOW())
  ORDER BY display_order
`;
export const listAllBanners = `SELECT * FROM banners ORDER BY position, display_order`;
export const createBanner = `
  INSERT INTO banners (
    title, subtitle, description, image_url, mobile_image_url, link_url, cta_text,
    position, discount_text, bg_color, text_color, display_order, starts_at, ends_at
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
  RETURNING *
`;
export const updateBanner = (fields: string[]) => `
  UPDATE banners SET ${fields.map((f, i) => `${f} = $${i + 2}`).join(", ")}, updated_at = NOW()
  WHERE id = $1
  RETURNING *
`;
export const softDeleteBanner = `UPDATE banners SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *`;
export const hardDeleteBanner = `DELETE FROM banners WHERE id = $1 RETURNING *`;

// ─── Testimonials ────────────────────────────────────────────

export const listActiveTestimonials = `
  SELECT * FROM testimonials WHERE page = $1 AND is_active = true ORDER BY display_order
`;
export const listAllTestimonials = `SELECT * FROM testimonials ORDER BY page, display_order`;
export const createTestimonial = `
  INSERT INTO testimonials (author_name, author_designation, author_avatar_url, quote, rating, page, display_order)
  VALUES ($1, $2, $3, $4, $5, $6, $7)
  RETURNING *
`;
export const updateTestimonial = (fields: string[]) => `
  UPDATE testimonials SET ${fields.map((f, i) => `${f} = $${i + 2}`).join(", ")}
  WHERE id = $1
  RETURNING *
`;
export const softDeleteTestimonial = `UPDATE testimonials SET is_active = false WHERE id = $1 RETURNING *`;

// ─── Recommended services ────────────────────────────────────

export const listRecommendedServices = `
  SELECT rs.*, s.title, s.slug, s.price, s.feature_image_url, s.rating_avg
  FROM recommended_services rs
  JOIN services s ON s.id = rs.service_id
  WHERE rs.page = $1 AND rs.section = $2 AND rs.is_active = true
    AND s.is_active = true AND s.status = 'published'
  ORDER BY rs.display_order
`;
export const listAllRecommendedServices = `
  SELECT rs.*, s.title, s.slug
  FROM recommended_services rs
  JOIN services s ON s.id = rs.service_id
  ORDER BY rs.page, rs.section, rs.display_order
`;
export const createRecommendedService = `
  INSERT INTO recommended_services (service_id, page, section, display_order)
  VALUES ($1, $2, $3, $4)
  RETURNING *
`;
export const updateRecommendedService = (fields: string[]) => `
  UPDATE recommended_services SET ${fields.map((f, i) => `${f} = $${i + 2}`).join(", ")}
  WHERE id = $1
  RETURNING *
`;
export const softDeleteRecommendedService = `
  UPDATE recommended_services SET is_active = false WHERE id = $1 RETURNING *
`;

// ─── Home aggregator reads ───────────────────────────────────

export const listRecentBlogs = `
  SELECT id, title, slug, excerpt, feature_image_url, published_at
  FROM blogs
  WHERE status = 'published'
  ORDER BY published_at DESC NULLS LAST
  LIMIT 6
`;

export const getAppSettingsByKeys = `
  SELECT key, value FROM app_settings WHERE key = ANY($1::text[])
`;
