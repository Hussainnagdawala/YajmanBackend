-- 005_addons.sql
-- Add-on catalog (name/image/price) assignable to services, selectable at
-- checkout, priced on top of the service base_price.

CREATE TABLE IF NOT EXISTS addons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(120) NOT NULL UNIQUE,
    image_url TEXT,
    price DECIMAL(10,2) NOT NULL,
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_addons_updated ON addons;
CREATE TRIGGER trg_addons_updated
  BEFORE UPDATE ON addons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Standalone junction: which addons a service offers. Independent of
-- service_types/service_tags — no shared relation, just the same shape.
CREATE TABLE IF NOT EXISTS service_addons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    addon_id UUID NOT NULL REFERENCES addons(id) ON DELETE CASCADE,
    UNIQUE(service_id, addon_id)
);

-- Per-order snapshot (name/price at time of order), so a later catalog
-- price change never rewrites history — same reasoning as orders.coupon_code.
CREATE TABLE IF NOT EXISTS order_addons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    addon_id UUID REFERENCES addons(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS addon_total DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Admin toggle: whether the addon picker is shown for this service on the
-- website. Independent of whether service_addons rows exist for it.
ALTER TABLE services ADD COLUMN IF NOT EXISTS is_addon_available BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_service_addons_service ON service_addons(service_id);
CREATE INDEX IF NOT EXISTS idx_service_addons_addon ON service_addons(addon_id);
CREATE INDEX IF NOT EXISTS idx_order_addons_order ON order_addons(order_id);
