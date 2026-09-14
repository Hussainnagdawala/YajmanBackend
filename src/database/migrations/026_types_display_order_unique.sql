-- 026_types_display_order_unique.sql
-- Each type must have a globally unique display_order (website sort position).
-- Mirrors 017_services_display_order_unique.sql / 019_categories_display_order_unique.sql.

WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      ORDER BY is_active DESC, display_order ASC, created_at ASC
    ) - 1 AS new_order
  FROM types
)
UPDATE types t
SET display_order = r.new_order
FROM ranked r
WHERE t.id = r.id
  AND t.display_order IS DISTINCT FROM r.new_order;

CREATE UNIQUE INDEX IF NOT EXISTS idx_types_display_order_unique
  ON types (display_order);
