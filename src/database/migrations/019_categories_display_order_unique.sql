-- 019_categories_display_order_unique.sql
-- Each category must have a globally unique display_order (website sort position).
-- Mirrors 017_services_display_order_unique.sql.

-- Collapse existing duplicates (and the shared default 0) into unique sequential
-- values while preserving the current relative order. Active categories first so
-- they keep the lowest positions.
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      ORDER BY is_active DESC, display_order ASC, created_at ASC
    ) - 1 AS new_order
  FROM categories
)
UPDATE categories c
SET display_order = r.new_order
FROM ranked r
WHERE c.id = r.id
  AND c.display_order IS DISTINCT FROM r.new_order;

CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_display_order_unique
  ON categories (display_order);
