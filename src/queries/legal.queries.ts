// ─── Legal pages (Terms, Privacy, Cookies, Disclaimer, Return Policy) ──────
// The five rows above are seeded by migration 020, but admin can also add and
// remove pages beyond those (open catalog). Slug regenerates from title on
// both create and update (see legal.controller.ts).

export const listActiveLegalPages = `
  SELECT slug, title, meta_title, meta_description, updated_at
  FROM legal_pages
  WHERE is_active = true
  ORDER BY title
`;

export const findLegalPageBySlug = `
  SELECT * FROM legal_pages WHERE slug = $1
`;

export const findActiveLegalPageBySlug = `
  SELECT * FROM legal_pages WHERE slug = $1 AND is_active = true
`;

export const listAllLegalPagesAdmin = `
  SELECT lp.*, u.name AS updated_by_name
  FROM legal_pages lp
  LEFT JOIN users u ON u.id = lp.updated_by
  ORDER BY lp.title
`;

export const findLegalPageByIdAdmin = `
  SELECT lp.*, u.name AS updated_by_name
  FROM legal_pages lp
  LEFT JOIN users u ON u.id = lp.updated_by
  WHERE lp.id = $1
`;

export const updateLegalPage = (fields: string[]) => `
  UPDATE legal_pages
  SET ${fields.map((f, i) => `${f} = $${i + 2}`).join(", ")}, updated_at = NOW()
  WHERE id = $1
  RETURNING *
`;

export const createLegalPage = `
  INSERT INTO legal_pages (slug, title, content, meta_title, meta_description, is_active, updated_by)
  VALUES ($1, $2, $3, $4, $5, $6, $7)
  RETURNING *
`;

export const softDeleteLegalPage = `
  UPDATE legal_pages SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *
`;

export const hardDeleteLegalPage = `DELETE FROM legal_pages WHERE id = $1 RETURNING *`;
