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
export const hardDeletePopularSearch = `DELETE FROM popular_searches WHERE id = $1 RETURNING *`;

// ─── Banners ─────────────────────────────────────────────────

// Admin sets start/end as plain dates (no time). Server runs in UTC, so a bare
// date lands at 00:00Z — comparing that with NOW() would drop the banner at the
// very start of its end date (5:30am IST) instead of keeping it live for the
// whole IST calendar day. Compare IST calendar dates, inclusive on both ends.
export const listActiveBannersByPosition = `
  SELECT * FROM banners
  WHERE position = $1 AND is_active = true
    AND (starts_at IS NULL
      OR (starts_at AT TIME ZONE 'Asia/Kolkata')::date <= (NOW() AT TIME ZONE 'Asia/Kolkata')::date)
    AND (ends_at IS NULL
      OR (ends_at AT TIME ZONE 'Asia/Kolkata')::date >= (NOW() AT TIME ZONE 'Asia/Kolkata')::date)
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
export const listActiveTestimonialsAll = `
  SELECT * FROM testimonials WHERE is_active = true ORDER BY page, display_order
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
export const hardDeleteTestimonial = `DELETE FROM testimonials WHERE id = $1 RETURNING *`;

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
