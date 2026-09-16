// ─── Services: core CRUD ────────────────────────────────────

import { pujaProcessJsonForService } from "./puja-process.queries";

export const createService = `
  INSERT INTO services (
    title, slug, category_id, type_id, price, original_price,
    short_description, about_puja, description, custom_content,
    pincode, latitude, longitude,
    feature_image_url, video_url, duration_minutes, advance_booking_days,
    is_featured, is_bestseller, display_order, meta_title, meta_description, created_by,
    is_addon_available, benefits, key_features,
    availability_start_date, availability_end_date, booking_availability_type, available_dates,
    puja_process_id
  ) VALUES (
    $1, $2, $3, $4, $5, $6,
    $7, $8, $9, $10,
    $11, $12, $13,
    $14, $15, $16, $17,
    $18, $19, $20, $21, $22, $23,
    $24, $25, $26,
    $27, $28, $29, $30,
    $31
  )
  RETURNING *
`;

export const updateService = (fields: string[]) => `
  UPDATE services SET ${fields.map((f, i) => `${f} = $${i + 2}`).join(", ")}, updated_at = NOW()
  WHERE id = $1
  RETURNING *
`;

export const findServiceById = `SELECT * FROM services WHERE id = $1`;

export const findServiceByDisplayOrder = `
  SELECT id, title FROM services
  WHERE display_order = $1 AND ($2::uuid IS NULL OR id != $2)
  LIMIT 1
`;

export const findServiceWithCategory = `
  SELECT s.id, s.title, c.id AS category_id, c.name AS category_name
  FROM services s
  JOIN categories c ON c.id = s.category_id
  WHERE s.id = $1
`;

export const findActiveServiceById = `
  SELECT s.*,
    c.requires_pandit, c.requires_payment, c.requires_booking_time, c.slug AS category_slug
  FROM services s
  JOIN categories c ON c.id = s.category_id
  WHERE s.id = $1 AND s.is_active = true AND s.status = 'published'
`;

export const hardDeleteService = `DELETE FROM services WHERE id = $1 RETURNING *`;
export const countContactEntriesByService = `SELECT COUNT(*)::int AS count FROM contact_form_entries WHERE service_id = $1`;
export const countOrdersByService = `SELECT COUNT(*)::int AS count FROM orders WHERE service_id = $1`;
// Fetch gallery URLs before the hard delete cascades service_images away.
export const findServiceImageUrls = `SELECT image_url FROM service_images WHERE service_id = $1`;

export const softDeleteService = `
  UPDATE services SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *
`;

// ─── Services: public listing ───────────────────────────────

export const listServices = (whereClauses: string[], orderBy: string, limitIdx: number, offsetIdx: number) => `
  SELECT s.*, c.name AS category_name, c.slug AS category_slug, c.requires_pandit, c.requires_payment, c.requires_booking_time
  FROM services s
  JOIN categories c ON c.id = s.category_id
  ${whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : ""}
  ORDER BY ${orderBy}
  LIMIT $${limitIdx} OFFSET $${offsetIdx}
`;

export const countServices = (whereClauses: string[]) => `
  SELECT COUNT(*)::int AS count
  FROM services s
  JOIN categories c ON c.id = s.category_id
  ${whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : ""}
`;

export const listBestsellers = `
  SELECT s.*, c.name AS category_name, c.slug AS category_slug
  FROM services s
  JOIN categories c ON c.id = s.category_id
  WHERE s.is_active = true AND s.status = 'published' AND s.is_bestseller = true
  ORDER BY c.display_order, s.display_order ASC, s.created_at DESC
`;

/** Trending / featured services for app carousels (flat list). */
export const listTrendingServices = `
  SELECT s.*, c.name AS category_name, c.slug AS category_slug
  FROM services s
  JOIN categories c ON c.id = s.category_id
  WHERE s.is_active = true AND s.status = 'published' AND s.is_featured = true
  ORDER BY s.display_order ASC, s.created_at DESC
  LIMIT $1 OFFSET $2
`;

export const countTrendingServices = `
  SELECT COUNT(*)::int AS count
  FROM services s
  WHERE s.is_active = true AND s.status = 'published' AND s.is_featured = true
`;

// ─── Services: single full detail ───────────────────────────

export const findServiceBySlug = `
  SELECT s.*,
    c.name AS category_name, c.slug AS category_slug, c.requires_pandit, c.requires_payment, c.requires_booking_time,
    ${pujaProcessJsonForService(true)},
    COALESCE(
      (SELECT json_agg(jsonb_build_object('id', si.id, 'url', si.image_url, 'alt_text', si.alt_text, 'display_order', si.display_order) ORDER BY si.display_order)
       FROM service_images si WHERE si.service_id = s.id), '[]'
    ) AS images,
    COALESCE(
      (SELECT json_agg(jsonb_build_object('id', t.id, 'name', t.name, 'slug', t.slug))
       FROM service_types st JOIN types t ON t.id = st.type_id WHERE st.service_id = s.id), '[]'
    ) AS types,
    COALESCE(
      (SELECT json_agg(jsonb_build_object('id', tg.id, 'name', tg.name, 'color', tg.color, 'bg_color', tg.bg_color))
       FROM service_tags stg JOIN tags tg ON tg.id = stg.tag_id WHERE stg.service_id = s.id), '[]'
    ) AS tags,
    COALESCE(
      (SELECT json_agg(jsonb_build_object('id', tm.id, 'name', tm.name, 'slug', tm.slug, 'city', tm.city, 'image_url', tm.image_url))
       FROM service_temples stt JOIN temples tm ON tm.id = stt.temple_id WHERE stt.service_id = s.id), '[]'
    ) AS temples,
    COALESCE(
      (SELECT json_agg(jsonb_build_object('id', p.id, 'title', p.title, 'description', p.description, 'items', p.items, 'price', p.price) ORDER BY p.display_order)
       FROM service_packages p WHERE p.service_id = s.id), '[]'
    ) AS packages,
    COALESCE(
      (SELECT json_agg(jsonb_build_object('id', f.id, 'question', f.question, 'answer', f.answer) ORDER BY f.display_order)
       FROM service_faqs f WHERE f.service_id = s.id AND f.is_active = true), '[]'
    ) AS faqs,
    COALESCE(
      (SELECT json_agg(jsonb_build_object('id', a.id, 'name', a.name, 'image_url', a.image_url, 'price', a.price))
       FROM service_addons sa JOIN addons a ON a.id = sa.addon_id WHERE sa.service_id = s.id AND a.is_active = true), '[]'
    ) AS addons
  FROM services s
  JOIN categories c ON c.id = s.category_id
  LEFT JOIN puja_processes pp ON pp.id = s.puja_process_id
  WHERE s.slug = $1 AND s.is_active = true AND s.status = 'published'
`;

export const findServiceByIdDetail = `
  SELECT s.*,
    c.name AS category_name, c.slug AS category_slug, c.requires_pandit, c.requires_payment, c.requires_booking_time,
    ${pujaProcessJsonForService(false)},
    COALESCE(
      (SELECT json_agg(jsonb_build_object('id', si.id, 'url', si.image_url, 'alt_text', si.alt_text, 'display_order', si.display_order) ORDER BY si.display_order)
       FROM service_images si WHERE si.service_id = s.id), '[]'
    ) AS images,
    COALESCE(
      (SELECT json_agg(jsonb_build_object('id', t.id, 'name', t.name, 'slug', t.slug))
       FROM service_types st JOIN types t ON t.id = st.type_id WHERE st.service_id = s.id), '[]'
    ) AS types,
    COALESCE(
      (SELECT json_agg(jsonb_build_object('id', tg.id, 'name', tg.name, 'color', tg.color, 'bg_color', tg.bg_color))
       FROM service_tags stg JOIN tags tg ON tg.id = stg.tag_id WHERE stg.service_id = s.id), '[]'
    ) AS tags,
    COALESCE(
      (SELECT json_agg(jsonb_build_object('id', tm.id, 'name', tm.name, 'slug', tm.slug, 'city', tm.city, 'image_url', tm.image_url))
       FROM service_temples stt JOIN temples tm ON tm.id = stt.temple_id WHERE stt.service_id = s.id), '[]'
    ) AS temples,
    COALESCE(
      (SELECT json_agg(jsonb_build_object('id', p.id, 'title', p.title, 'description', p.description, 'items', p.items, 'price', p.price) ORDER BY p.display_order)
       FROM service_packages p WHERE p.service_id = s.id), '[]'
    ) AS packages,
    COALESCE(
      (SELECT json_agg(jsonb_build_object('id', f.id, 'question', f.question, 'answer', f.answer) ORDER BY f.display_order)
       FROM service_faqs f WHERE f.service_id = s.id AND f.is_active = true), '[]'
    ) AS faqs,
    COALESCE(
      (SELECT json_agg(jsonb_build_object('id', a.id, 'name', a.name, 'image_url', a.image_url, 'price', a.price))
       FROM service_addons sa JOIN addons a ON a.id = sa.addon_id WHERE sa.service_id = s.id AND a.is_active = true), '[]'
    ) AS addons
  FROM services s
  JOIN categories c ON c.id = s.category_id
  LEFT JOIN puja_processes pp ON pp.id = s.puja_process_id
  WHERE s.id = $1
`;

// ─── Junctions: types / tags / temples ──────────────────────

export const clearServiceTypes = `DELETE FROM service_types WHERE service_id = $1`;
export const setServiceTypes = `
  INSERT INTO service_types (service_id, type_id)
  SELECT $1, unnest($2::uuid[])
  ON CONFLICT (service_id, type_id) DO NOTHING
`;

export const clearServiceTags = `DELETE FROM service_tags WHERE service_id = $1`;
export const setServiceTags = `
  INSERT INTO service_tags (service_id, tag_id)
  SELECT $1, unnest($2::uuid[])
  ON CONFLICT (service_id, tag_id) DO NOTHING
`;

export const clearServiceTemples = `DELETE FROM service_temples WHERE service_id = $1`;
export const setServiceTemples = `
  INSERT INTO service_temples (service_id, temple_id)
  SELECT $1, unnest($2::uuid[])
  ON CONFLICT (service_id, temple_id) DO NOTHING
`;

// ─── Nested arrays: packages / FAQs ──────────────────────────
// key_features is a flat TEXT[] column on services now (see benefits) — no
// child table/junction to clear-and-reinsert.

export const clearPackages = `DELETE FROM service_packages WHERE service_id = $1`;
export const insertPackage = `
  INSERT INTO service_packages (service_id, title, description, items, price, display_order)
  VALUES ($1, $2, $3, $4, $5, $6)
`;

export const clearFaqs = `DELETE FROM service_faqs WHERE service_id = $1`;
export const insertFaq = `
  INSERT INTO service_faqs (service_id, question, answer, display_order)
  VALUES ($1, $2, $3, $4)
`;

// ─── Gallery images ──────────────────────────────────────────

export const insertServiceImage = `
  INSERT INTO service_images (service_id, image_url, alt_text, display_order)
  VALUES ($1, $2, $3, $4)
  RETURNING *
`;

export const findServiceImageById = `SELECT * FROM service_images WHERE id = $1 AND service_id = $2`;

export const deleteServiceImage = `DELETE FROM service_images WHERE id = $1 AND service_id = $2 RETURNING *`;

export const maxServiceImageOrder = `
  SELECT COALESCE(MAX(display_order), -1)::int AS max_order FROM service_images WHERE service_id = $1
`;

// Reconciles the gallery on update: the admin form submits the full list of
// URLs the user kept (removed ones are simply absent), so anything on this
// service NOT in that list was removed and should be deleted.
export const deleteServiceImagesNotIn = `
  DELETE FROM service_images
  WHERE service_id = $1 AND NOT (image_url = ANY($2::text[]))
  RETURNING image_url
`;

// ─── Temples ─────────────────────────────────────────────────

export const listAllTemples = `SELECT * FROM temples ORDER BY name`;

export const findTempleById = `SELECT * FROM temples WHERE id = $1`;

export const createTemple = `
  INSERT INTO temples (name, slug, description, address, city, state, latitude, longitude, image_url)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  RETURNING *
`;

export const updateTemple = (fields: string[]) => `
  UPDATE temples SET ${fields.map((f, i) => `${f} = $${i + 2}`).join(", ")}
  WHERE id = $1
  RETURNING *
`;

export const softDeleteTemple = `UPDATE temples SET is_active = false WHERE id = $1 RETURNING *`;
export const hardDeleteTemple = `DELETE FROM temples WHERE id = $1 RETURNING *`;
