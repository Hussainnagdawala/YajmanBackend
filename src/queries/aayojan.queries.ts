// ─── Page content ────────────────────────────────────────────

export const listActiveAayojanContent = `
  SELECT * FROM aayojan_page_content WHERE is_active = true ORDER BY display_order
`;
export const listAllAayojanContent = `SELECT * FROM aayojan_page_content ORDER BY display_order`;
export const createAayojanContent = `
  INSERT INTO aayojan_page_content (section_key, title, subtitle, description, image_url, cta_text, cta_link, display_order)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  RETURNING *
`;
export const updateAayojanContent = (fields: string[]) => `
  UPDATE aayojan_page_content SET ${fields.map((f, i) => `${f} = $${i + 2}`).join(", ")}, updated_at = NOW()
  WHERE id = $1
  RETURNING *
`;
export const softDeleteAayojanContent = `
  UPDATE aayojan_page_content SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *
`;
export const hardDeleteAayojanContent = `DELETE FROM aayojan_page_content WHERE id = $1 RETURNING *`;

// ─── Events ──────────────────────────────────────────────────

export const listActiveAayojanEvents = `
  SELECT * FROM aayojan_events WHERE is_active = true AND status = 'published' ORDER BY event_date NULLS LAST
`;
export const listAllAayojanEvents = `SELECT * FROM aayojan_events ORDER BY created_at DESC`;

export const findAayojanEventById = `SELECT * FROM aayojan_events WHERE id = $1`;

export const findAayojanEventBySlug = `
  SELECT e.*,
    COALESCE(
      (SELECT json_agg(jsonb_build_object('id', ei.id, 'url', ei.image_url) ORDER BY ei.display_order)
       FROM aayojan_event_images ei WHERE ei.event_id = e.id), '[]'
    ) AS images
  FROM aayojan_events e
  WHERE e.slug = $1 AND e.is_active = true AND e.status = 'published'
`;

export const createAayojanEvent = `
  INSERT INTO aayojan_events (
    title, slug, description, short_description, feature_image_url,
    location, city, event_date, event_time, price, original_price, max_capacity, status
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
  RETURNING *
`;

export const updateAayojanEvent = (fields: string[]) => `
  UPDATE aayojan_events SET ${fields.map((f, i) => `${f} = $${i + 2}`).join(", ")}, updated_at = NOW()
  WHERE id = $1
  RETURNING *
`;

export const softDeleteAayojanEvent = `
  UPDATE aayojan_events SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *
`;
export const hardDeleteAayojanEvent = `DELETE FROM aayojan_events WHERE id = $1 RETURNING *`;
export const countOrdersByAayojanEvent = `SELECT COUNT(*)::int AS count FROM orders WHERE aayojan_event_id = $1`;
// Fetch gallery URLs before the hard delete cascades aayojan_event_images away.
export const findAayojanEventImageUrls = `SELECT image_url FROM aayojan_event_images WHERE event_id = $1`;

export const insertAayojanEventImage = `
  INSERT INTO aayojan_event_images (event_id, image_url, display_order)
  VALUES ($1, $2, $3)
  RETURNING *
`;
export const maxAayojanEventImageOrder = `
  SELECT COALESCE(MAX(display_order), -1)::int AS max_order FROM aayojan_event_images WHERE event_id = $1
`;

// ─── Banners ─────────────────────────────────────────────────

export const listActiveAayojanBanners = `
  SELECT * FROM aayojan_banners WHERE is_active = true ORDER BY display_order
`;
export const listAllAayojanBanners = `SELECT * FROM aayojan_banners ORDER BY display_order`;
export const createAayojanBanner = `
  INSERT INTO aayojan_banners (title, image_url, link_url, display_order)
  VALUES ($1, $2, $3, $4)
  RETURNING *
`;
export const updateAayojanBanner = (fields: string[]) => `
  UPDATE aayojan_banners SET ${fields.map((f, i) => `${f} = $${i + 2}`).join(", ")}
  WHERE id = $1
  RETURNING *
`;
export const softDeleteAayojanBanner = `UPDATE aayojan_banners SET is_active = false WHERE id = $1 RETURNING *`;
export const hardDeleteAayojanBanner = `DELETE FROM aayojan_banners WHERE id = $1 RETURNING *`;
