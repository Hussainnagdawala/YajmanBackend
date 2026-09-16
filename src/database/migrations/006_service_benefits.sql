-- 006_service_benefits.sql
-- Plain string-array column on services (distinct from service_key_features,
-- which is a full child table with title/description/icon_url per row).

ALTER TABLE services ADD COLUMN IF NOT EXISTS benefits TEXT[] NOT NULL DEFAULT '{}';
