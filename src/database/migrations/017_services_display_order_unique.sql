-- 017_services_display_order_unique.sql
-- Each service must have a globally unique display_order (website sort position).

-- Assign unique sequential values where duplicates exist (preserve relative order).
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (ORDER BY display_order ASC, created_at ASC) - 1 AS new_order
  FROM services
)
UPDATE services s
SET display_order = r.new_order
FROM ranked r
WHERE s.id = r.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_services_display_order_unique ON services (display_order);
