// ─── Blog categories ─────────────────────────────────────────

export const listActiveBlogCategories = `
  SELECT * FROM blog_categories WHERE is_active = true ORDER BY display_order, name
`;
export const listAllBlogCategories = `SELECT * FROM blog_categories ORDER BY display_order, name`;
export const createBlogCategory = `
  INSERT INTO blog_categories (name, slug, description, display_order)
  VALUES ($1, $2, $3, $4)
  RETURNING *
`;
export const updateBlogCategory = (fields: string[]) => `
  UPDATE blog_categories SET ${fields.map((f, i) => `${f} = $${i + 2}`).join(", ")}
  WHERE id = $1
  RETURNING *
`;
export const softDeleteBlogCategory = `UPDATE blog_categories SET is_active = false WHERE id = $1 RETURNING *`;
export const hardDeleteBlogCategory = `DELETE FROM blog_categories WHERE id = $1 RETURNING *`;
export const countBlogsByCategory = `SELECT COUNT(*)::int AS count FROM blogs WHERE category_id = $1`;

// ─── Blog authors ────────────────────────────────────────────

export const listAllBlogAuthors = `SELECT * FROM blog_authors ORDER BY name`;
export const createBlogAuthor = `
  INSERT INTO blog_authors (name, slug, bio, user_id, avatar_url)
  VALUES ($1, $2, $3, $4, $5)
  RETURNING *
`;
export const updateBlogAuthor = (fields: string[]) => `
  UPDATE blog_authors SET ${fields.map((f, i) => `${f} = $${i + 2}`).join(", ")}
  WHERE id = $1
  RETURNING *
`;
export const deleteBlogAuthor = `DELETE FROM blog_authors WHERE id = $1 RETURNING *`;

// ─── Blogs: core CRUD ────────────────────────────────────────

export const createBlog = `
  INSERT INTO blogs (
    title, slug, category_id, author_id, excerpt, content, feature_image_url,
    is_featured, status, published_at, meta_title, meta_description
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
  RETURNING *
`;

export const updateBlog = (fields: string[]) => `
  UPDATE blogs SET ${fields.map((f, i) => `${f} = $${i + 2}`).join(", ")}, updated_at = NOW()
  WHERE id = $1
  RETURNING *
`;

export const findBlogById = `SELECT * FROM blogs WHERE id = $1`;

export const softDeleteBlog = `UPDATE blogs SET status = 'archived', updated_at = NOW() WHERE id = $1 RETURNING *`;
export const hardDeleteBlog = `DELETE FROM blogs WHERE id = $1 RETURNING *`;
// Fetch gallery URLs before the hard delete cascades blog_images away, so the
// controller can still clean up the files from disk afterward.
export const findBlogImageUrls = `SELECT image_url FROM blog_images WHERE blog_id = $1`;

// ─── Blogs: public listing + detail ──────────────────────────

export const listBlogs = (whereClauses: string[], limitIdx: number, offsetIdx: number) => `
  SELECT b.*, bc.name AS category_name, bc.slug AS category_slug, ba.name AS author_name
  FROM blogs b
  LEFT JOIN blog_categories bc ON bc.id = b.category_id
  LEFT JOIN blog_authors ba ON ba.id = b.author_id
  ${whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : ""}
  ORDER BY b.published_at DESC NULLS LAST, b.created_at DESC
  LIMIT $${limitIdx} OFFSET $${offsetIdx}
`;

export const countBlogs = (whereClauses: string[]) => `
  SELECT COUNT(*)::int AS count
  FROM blogs b
  LEFT JOIN blog_categories bc ON bc.id = b.category_id
  ${whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : ""}
`;

export const listBlogsAdmin = (whereClauses: string[], limitIdx: number, offsetIdx: number) => `
  SELECT b.*, bc.name AS category_name, ba.name AS author_name
  FROM blogs b
  LEFT JOIN blog_categories bc ON bc.id = b.category_id
  LEFT JOIN blog_authors ba ON ba.id = b.author_id
  ${whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : ""}
  ORDER BY b.created_at DESC
  LIMIT $${limitIdx} OFFSET $${offsetIdx}
`;

export const countBlogsAdmin = (whereClauses: string[]) => `
  SELECT COUNT(*)::int AS count FROM blogs b
  ${whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : ""}
`;

export const findBlogBySlug = `
  SELECT b.*,
    bc.name AS category_name, bc.slug AS category_slug,
    ba.name AS author_name, ba.bio AS author_bio, ba.avatar_url AS author_avatar_url,
    COALESCE(
      (SELECT json_agg(jsonb_build_object('id', bi.id, 'url', bi.image_url, 'alt_text', bi.alt_text) ORDER BY bi.display_order)
       FROM blog_images bi WHERE bi.blog_id = b.id), '[]'
    ) AS images,
    COALESCE(
      (SELECT json_agg(jsonb_build_object('id', rb.id, 'title', rb.title, 'slug', rb.slug, 'feature_image_url', rb.feature_image_url) ORDER BY br.display_order)
       FROM blog_recommended br JOIN blogs rb ON rb.id = br.recommended_blog_id
       WHERE br.blog_id = b.id AND rb.status = 'published'), '[]'
    ) AS related_blogs
  FROM blogs b
  LEFT JOIN blog_categories bc ON bc.id = b.category_id
  LEFT JOIN blog_authors ba ON ba.id = b.author_id
  WHERE b.slug = $1 AND b.status = 'published'
`;

// Same shape as findBlogBySlug but no status filter and keyed by id — for the
// admin edit screen, which needs to load drafts/archived posts too.
export const findBlogByIdAdmin = `
  SELECT b.*,
    bc.name AS category_name, bc.slug AS category_slug,
    ba.name AS author_name, ba.bio AS author_bio, ba.avatar_url AS author_avatar_url,
    COALESCE(
      (SELECT json_agg(jsonb_build_object('id', bi.id, 'url', bi.image_url, 'alt_text', bi.alt_text) ORDER BY bi.display_order)
       FROM blog_images bi WHERE bi.blog_id = b.id), '[]'
    ) AS images,
    COALESCE(
      (SELECT json_agg(jsonb_build_object('id', rb.id, 'title', rb.title, 'slug', rb.slug, 'feature_image_url', rb.feature_image_url) ORDER BY br.display_order)
       FROM blog_recommended br JOIN blogs rb ON rb.id = br.recommended_blog_id
       WHERE br.blog_id = b.id), '[]'
    ) AS related_blogs
  FROM blogs b
  LEFT JOIN blog_categories bc ON bc.id = b.category_id
  LEFT JOIN blog_authors ba ON ba.id = b.author_id
  WHERE b.id = $1
`;

export const listSidebarServices = `
  SELECT id, title, slug, price, feature_image_url, rating_avg
  FROM services
  WHERE is_active = true AND status = 'published' AND (is_featured = true OR is_bestseller = true)
  ORDER BY display_order
  LIMIT 5
`;

// ─── Junctions: recommended blogs / gallery images ───────────

export const clearRecommendedBlogs = `DELETE FROM blog_recommended WHERE blog_id = $1`;
export const setRecommendedBlogs = `
  INSERT INTO blog_recommended (blog_id, recommended_blog_id)
  SELECT $1, unnest($2::uuid[])
  ON CONFLICT (blog_id, recommended_blog_id) DO NOTHING
`;

export const insertBlogImage = `
  INSERT INTO blog_images (blog_id, image_url, alt_text, display_order)
  VALUES ($1, $2, $3, $4)
  RETURNING *
`;
export const maxBlogImageOrder = `
  SELECT COALESCE(MAX(display_order), -1)::int AS max_order FROM blog_images WHERE blog_id = $1
`;
