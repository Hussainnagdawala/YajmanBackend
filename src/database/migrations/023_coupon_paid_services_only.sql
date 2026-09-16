-- 023_coupon_paid_services_only.sql
-- Coupons apply to selected paid services only (no category targeting, no site-wide codes).
-- Expand legacy applicable_categories / unrestricted coupons into explicit paid service IDs.

UPDATE coupons c
SET applicable_services = (
  SELECT COALESCE(array_agg(DISTINCT sid), ARRAY[]::uuid[])
  FROM (
    -- Keep any services already assigned
    SELECT unnest(COALESCE(c.applicable_services, ARRAY[]::uuid[])) AS sid
    UNION
    -- Category-targeted coupons: paid services in those categories
    SELECT s.id
    FROM services s
    JOIN categories cat ON cat.id = s.category_id
    WHERE cat.requires_payment = true
      AND c.applicable_categories IS NOT NULL
      AND cardinality(c.applicable_categories) > 0
      AND s.category_id = ANY(c.applicable_categories)
    UNION
    -- Unrestricted coupons (no services and no categories): all current paid services
    SELECT s.id
    FROM services s
    JOIN categories cat ON cat.id = s.category_id
    WHERE cat.requires_payment = true
      AND (c.applicable_services IS NULL OR cardinality(c.applicable_services) = 0)
      AND (c.applicable_categories IS NULL OR cardinality(c.applicable_categories) = 0)
  ) mapped
  WHERE sid IS NOT NULL
),
applicable_categories = NULL;

-- Drop unpaid services that were explicitly assigned
UPDATE coupons c
SET applicable_services = (
  SELECT COALESCE(array_agg(s.id), ARRAY[]::uuid[])
  FROM services s
  JOIN categories cat ON cat.id = s.category_id
  WHERE s.id = ANY(COALESCE(c.applicable_services, ARRAY[]::uuid[]))
    AND cat.requires_payment = true
);

COMMENT ON COLUMN coupons.applicable_services IS 'paid-services-only';
