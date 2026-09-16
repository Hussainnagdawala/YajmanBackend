-- 007_service_key_features_flat.sql
-- key_features downgraded from a child table (title/description/icon_url per
-- row) to a flat string array on services, same shape as benefits. Table was
-- empty (0 rows) at time of this change.

ALTER TABLE services ADD COLUMN IF NOT EXISTS key_features TEXT[] NOT NULL DEFAULT '{}';
DROP TABLE IF EXISTS service_key_features;
