-- 018_service_placements_enhance.sql
-- Extend recommended_services for curated service placements (sidebar, inline ads, etc.)

ALTER TABLE recommended_services
  ADD COLUMN IF NOT EXISTS label VARCHAR(100),
  ADD COLUMN IF NOT EXISTS cta_text VARCHAR(50),
  ADD COLUMN IF NOT EXISTS starts_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS ends_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

DROP TRIGGER IF EXISTS trg_recommended_services_updated ON recommended_services;
CREATE TRIGGER trg_recommended_services_updated
  BEFORE UPDATE ON recommended_services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE UNIQUE INDEX IF NOT EXISTS idx_recommended_services_page_section_order
  ON recommended_services (page, section, display_order)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_recommended_services_lookup
  ON recommended_services (page, section, is_active, display_order);
