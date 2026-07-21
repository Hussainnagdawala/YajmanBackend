// ─── Categories ─────────────────────────────────────────────

export const listActiveCategories = `
  SELECT c.*,
    COALESCE(
      json_agg(
        jsonb_build_object('id', t.id, 'name', t.name, 'slug', t.slug)
      ) FILTER (WHERE t.id IS NOT NULL),
      '[]'
    ) AS types,
    COUNT(DISTINCT t.id)::int AS type_count
  FROM categories c
  LEFT JOIN category_types ct ON ct.category_id = c.id
  LEFT JOIN types t ON t.id = ct.type_id AND t.is_active = true
  WHERE c.is_active = true
  GROUP BY c.id
  ORDER BY c.display_order, c.name
`;

export const listAllCategories = `
  SELECT c.*,
    COALESCE(
      json_agg(
        jsonb_build_object('id', t.id, 'name', t.name, 'slug', t.slug)
      ) FILTER (WHERE t.id IS NOT NULL),
      '[]'
    ) AS types,
    COUNT(DISTINCT t.id)::int AS type_count
  FROM categories c
  LEFT JOIN category_types ct ON ct.category_id = c.id
  LEFT JOIN types t ON t.id = ct.type_id
  GROUP BY c.id
  ORDER BY c.display_order, c.name
`;

export const findCategoryById = `
  SELECT c.*,
    COALESCE(
      json_agg(
        jsonb_build_object('id', t.id, 'name', t.name, 'slug', t.slug)
      ) FILTER (WHERE t.id IS NOT NULL),
      '[]'
    ) AS types,
    COUNT(DISTINCT t.id)::int AS type_count
  FROM categories c
  LEFT JOIN category_types ct ON ct.category_id = c.id
  LEFT JOIN types t ON t.id = ct.type_id
  WHERE c.id = $1
  GROUP BY c.id
`;

export const createCategory = `
  INSERT INTO categories (name, slug, description, image_url, icon_url, display_order, meta_title, meta_description)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  RETURNING *
`;

export const updateCategory = (fields: string[]) => `
  UPDATE categories SET ${fields.map((f, i) => `${f} = $${i + 2}`).join(", ")}, updated_at = NOW()
  WHERE id = $1
  RETURNING *
`;

export const softDeleteCategory = `
  UPDATE categories SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *
`;

export const countServicesByCategory = `SELECT COUNT(*)::int AS count FROM services WHERE category_id = $1`;

export const setCategoryTypes = `
  INSERT INTO category_types (category_id, type_id)
  SELECT $1, unnest($2::uuid[])
  ON CONFLICT (category_id, type_id) DO NOTHING
`;

export const clearCategoryTypes = `DELETE FROM category_types WHERE category_id = $1`;

// ─── Types ──────────────────────────────────────────────────

export const listActiveTypes = `
  SELECT * FROM types WHERE is_active = true ORDER BY display_order, name
`;

export const listAllTypes = `SELECT * FROM types ORDER BY display_order, name`;

export const findTypeById = `SELECT * FROM types WHERE id = $1`;

export const createType = `
  INSERT INTO types (name, slug, description, image_url, display_order)
  VALUES ($1, $2, $3, $4, $5)
  RETURNING *
`;

export const updateType = (fields: string[]) => `
  UPDATE types SET ${fields.map((f, i) => `${f} = $${i + 2}`).join(", ")}, updated_at = NOW()
  WHERE id = $1
  RETURNING *
`;

export const softDeleteType = `
  UPDATE types SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *
`;

// ─── Tags ───────────────────────────────────────────────────

export const listActiveTags = `SELECT * FROM tags WHERE is_active = true ORDER BY display_order, name`;

export const listAllTags = `SELECT * FROM tags ORDER BY display_order, name`;

export const findTagById = `SELECT * FROM tags WHERE id = $1`;

export const createTag = `
  INSERT INTO tags (name, slug, color, bg_color, display_order)
  VALUES ($1, $2, $3, $4, $5)
  RETURNING *
`;

export const updateTag = (fields: string[]) => `
  UPDATE tags SET ${fields.map((f, i) => `${f} = $${i + 2}`).join(", ")}
  WHERE id = $1
  RETURNING *
`;

export const softDeleteTag = `UPDATE tags SET is_active = false WHERE id = $1 RETURNING *`;
