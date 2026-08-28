const serviceJson = `
  jsonb_build_object(
    'id', s.id,
    'title', s.title,
    'slug', s.slug,
    'price', s.price,
    'original_price', s.original_price,
    'feature_image_url', s.feature_image_url,
    'short_description', s.short_description,
    'rating_avg', s.rating_avg,
    'category_slug', c.slug
  ) AS service
`;

const scheduleFilter = `
  AND (rs.starts_at IS NULL OR rs.starts_at <= NOW())
  AND (rs.ends_at IS NULL OR rs.ends_at >= NOW())
`;

export const listActiveServicePlacements = `
  SELECT rs.id, rs.page, rs.section, rs.display_order, rs.label, rs.cta_text,
    rs.starts_at, rs.ends_at,
    ${serviceJson}
  FROM recommended_services rs
  JOIN services s ON s.id = rs.service_id
  JOIN categories c ON c.id = s.category_id
  WHERE rs.page = $1 AND rs.section = $2 AND rs.is_active = true
    ${scheduleFilter}
    AND s.is_active = true AND s.status = 'published'
  ORDER BY rs.display_order ASC, rs.created_at ASC
  LIMIT $3
`;

export const listAllServicePlacements = `
  SELECT rs.*,
    jsonb_build_object(
      'id', s.id,
      'title', s.title,
      'slug', s.slug,
      'price', s.price,
      'feature_image_url', s.feature_image_url,
      'status', s.status,
      'is_active', s.is_active
    ) AS service
  FROM recommended_services rs
  JOIN services s ON s.id = rs.service_id
  ORDER BY rs.page, rs.section, rs.display_order
`;

export const listServicePlacementsFiltered = `
  SELECT rs.*,
    jsonb_build_object(
      'id', s.id,
      'title', s.title,
      'slug', s.slug,
      'price', s.price,
      'feature_image_url', s.feature_image_url,
      'status', s.status,
      'is_active', s.is_active
    ) AS service
  FROM recommended_services rs
  JOIN services s ON s.id = rs.service_id
  WHERE ($1::text IS NULL OR rs.page = $1)
    AND ($2::text IS NULL OR rs.section = $2)
  ORDER BY rs.page, rs.section, rs.display_order
`;

export const findServicePlacementById = `
  SELECT rs.*,
    jsonb_build_object(
      'id', s.id,
      'title', s.title,
      'slug', s.slug,
      'price', s.price,
      'original_price', s.original_price,
      'feature_image_url', s.feature_image_url,
      'short_description', s.short_description,
      'rating_avg', s.rating_avg,
      'status', s.status,
      'is_active', s.is_active,
      'category_slug', c.slug
    ) AS service
  FROM recommended_services rs
  JOIN services s ON s.id = rs.service_id
  JOIN categories c ON c.id = s.category_id
  WHERE rs.id = $1
`;

export const findServicePlacementByDisplayOrder = `
  SELECT rs.id, rs.display_order, s.title AS service_title
  FROM recommended_services rs
  JOIN services s ON s.id = rs.service_id
  WHERE rs.page = $1 AND rs.section = $2 AND rs.display_order = $3
    AND rs.is_active = true
    AND ($4::uuid IS NULL OR rs.id != $4)
  LIMIT 1
`;

export const countActiveServicePlacements = `
  SELECT COUNT(*)::int AS count
  FROM recommended_services rs
  WHERE rs.page = $1 AND rs.section = $2 AND rs.is_active = true
    AND ($3::uuid IS NULL OR rs.id != $3)
`;

export const createServicePlacement = `
  INSERT INTO recommended_services (
    service_id, page, section, display_order, label, cta_text, starts_at, ends_at
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  RETURNING *
`;

export const updateServicePlacement = (fields: string[]) => `
  UPDATE recommended_services SET ${fields.map((f, i) => `${f} = $${i + 2}`).join(", ")}, updated_at = NOW()
  WHERE id = $1
  RETURNING *
`;

export const softDeleteServicePlacement = `
  UPDATE recommended_services SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *
`;

export const hardDeleteServicePlacement = `DELETE FROM recommended_services WHERE id = $1 RETURNING *`;
