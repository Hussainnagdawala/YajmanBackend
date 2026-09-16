-- ============================================================================
-- COMBINED CATCH-UP MIGRATION  (squash of 001 .. 020)
-- Generated: 2026-09-03
--
-- Purpose: bring a server database that is behind (dump reference:
--   dump/dump-yajman-schema-202608221235.sql, roughly at migration ~014
--   minus 002/003/004) fully up to date in ONE run.
--
-- Every statement is idempotent / guarded, so this file is SAFE to run
-- regardless of which individual migrations the target DB already has.
-- Re-running it is a no-op.
--
-- Requires: PostgreSQL 12+ (for ALTER TYPE ... ADD VALUE inside a tx block),
--           extension "uuid-ossp" (uuid_generate_v4) and function
--           public.update_updated_at() -- both already present in the dump.
--
-- Run:
--   node scripts/run-migration.js combined_catchup_2026-09-03.sql
--   -- or --
--   psql "$DATABASE_URL" -f src/database/migrations/combined_catchup_2026-09-03.sql
--   (do NOT pass psql -1 / --single-transaction: the ALTER TYPE ADD VALUE
--    statements in section 010 must autocommit.)
-- ============================================================================


-- ============================================================
-- 001: Device tokens for push notifications
-- ============================================================
DO $$ BEGIN
  CREATE TYPE device_platform AS ENUM ('web', 'android', 'ios');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS device_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    platform device_platform NOT NULL,
    device_info JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens(user_id, is_active);


-- ============================================================
-- 002: Notification campaigns + inbox extensions
-- ============================================================
DO $$ BEGIN
  CREATE TYPE notification_target_type AS ENUM ('all', 'selected', 'group', 'topic');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE notification_campaign_status AS ENUM (
    'draft', 'scheduled', 'sending', 'sent', 'cancelled', 'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE notification_delivery_status AS ENUM (
    'pending', 'sent', 'delivered', 'failed', 'skipped'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS notification_campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    image_url TEXT,
    type VARCHAR(50) DEFAULT 'promo',
    target_type notification_target_type NOT NULL DEFAULT 'all',
    target_user_ids UUID[],
    status notification_campaign_status NOT NULL DEFAULT 'draft',
    deep_link TEXT,
    action_type VARCHAR(50),
    action_value TEXT,
    scheduled_at TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    total_users INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_campaigns_status_scheduled
  ON notification_campaigns(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_notification_campaigns_created
  ON notification_campaigns(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_campaigns_created_by
  ON notification_campaigns(created_by);

DROP TRIGGER IF EXISTS trg_notification_campaigns_updated ON notification_campaigns;
CREATE TRIGGER trg_notification_campaigns_updated
  BEFORE UPDATE ON notification_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES notification_campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS deep_link TEXT,
  ADD COLUMN IF NOT EXISTS action_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS action_value TEXT,
  ADD COLUMN IF NOT EXISTS delivery_status notification_delivery_status DEFAULT 'sent',
  ADD COLUMN IF NOT EXISTS failure_reason TEXT,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_notifications_campaign ON notifications(campaign_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_inbox
  ON notifications(user_id, deleted_at, created_at DESC);


-- ============================================================
-- 003: Extend app_settings with category / typing / visibility flags + catalog
-- ============================================================
ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS category VARCHAR(50) NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS value_type VARCHAR(20) NOT NULL DEFAULT 'string',
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_editable BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_app_settings_category ON app_settings(category);
CREATE INDEX IF NOT EXISTS idx_app_settings_is_public ON app_settings(is_public);

DROP TRIGGER IF EXISTS trg_app_settings_updated ON app_settings;
CREATE TRIGGER trg_app_settings_updated
  BEFORE UPDATE ON app_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

UPDATE app_settings SET category = 'booking', value_type = 'number', is_public = true, is_editable = true
  WHERE key = 'booking_advance_hours';
UPDATE app_settings SET category = 'booking', value_type = 'number', is_public = false, is_editable = true
  WHERE key = 'pandit_response_hours';
UPDATE app_settings SET category = 'security', value_type = 'number', is_public = false, is_editable = true
  WHERE key = 'otp_expiry_minutes';
UPDATE app_settings SET category = 'security', value_type = 'number', is_public = false, is_editable = true
  WHERE key = 'max_otp_attempts';
UPDATE app_settings SET category = 'system', value_type = 'string', is_public = false, is_editable = false
  WHERE key = 'razorpay_key_id';
UPDATE app_settings SET category = 'system', value_type = 'string', is_public = false, is_editable = false
  WHERE key = 'razorpay_key_secret';
UPDATE app_settings SET category = 'support', value_type = 'string', is_public = true, is_editable = true
  WHERE key = 'support_phone';
UPDATE app_settings SET category = 'support', value_type = 'string', is_public = true, is_editable = true
  WHERE key = 'support_email';
UPDATE app_settings SET category = 'support', value_type = 'string', is_public = true, is_editable = true
  WHERE key = 'support_whatsapp';
UPDATE app_settings SET category = 'system', value_type = 'string', is_public = false, is_editable = true
  WHERE key = 'invoice_prefix';
UPDATE app_settings SET category = 'system', value_type = 'string', is_public = false, is_editable = true
  WHERE key = 'order_prefix';
UPDATE app_settings SET category = 'system', value_type = 'string', is_public = false, is_editable = false
  WHERE key = 's3_bucket';
UPDATE app_settings SET category = 'system', value_type = 'string', is_public = false, is_editable = false
  WHERE key = 's3_region';
UPDATE app_settings SET category = 'media', value_type = 'number', is_public = true, is_editable = true
  WHERE key = 'max_upload_size_mb';

INSERT INTO app_settings (key, value, description, category, value_type, is_public, is_editable)
VALUES
  ('android.latest_version', '1.0.0', 'Latest Android app version on Play Store', 'android', 'string', true, true),
  ('android.minimum_supported_version', '1.0.0', 'Minimum Android version allowed without force update', 'android', 'string', true, true),
  ('android.force_update', 'false', 'Force all Android users to update', 'android', 'boolean', true, true),
  ('android.update_message', 'A new version is available', 'Android update prompt message', 'android', 'string', true, true),
  ('android.store_url', 'https://play.google.com/store/apps/details?id=in.yajman.app', 'Google Play store URL', 'android', 'string', true, true),
  ('ios.latest_version', '1.0.0', 'Latest iOS app version on App Store', 'ios', 'string', true, true),
  ('ios.minimum_supported_version', '1.0.0', 'Minimum iOS version allowed without force update', 'ios', 'string', true, true),
  ('ios.force_update', 'false', 'Force all iOS users to update', 'ios', 'boolean', true, true),
  ('ios.update_message', 'A new version is available', 'iOS update prompt message', 'ios', 'string', true, true),
  ('ios.store_url', 'https://apps.apple.com/app/id000000000', 'Apple App Store URL', 'ios', 'string', true, true),
  ('general.app_name', 'Yajman', 'App display name', 'general', 'string', true, true),
  ('general.app_tagline', 'Book pandits for every occasion', 'App tagline', 'general', 'string', true, true),
  ('general.website_url', 'https://yajmanapp.in', 'Marketing website URL', 'general', 'string', true, true),
  ('general.maintenance_message', '', 'Message shown during maintenance mode', 'general', 'string', true, true),
  ('social.facebook_url', '', 'Facebook page URL', 'social', 'string', true, true),
  ('social.instagram_url', '', 'Instagram profile URL', 'social', 'string', true, true),
  ('social.youtube_url', '', 'YouTube channel URL', 'social', 'string', true, true),
  ('social.twitter_url', '', 'X / Twitter profile URL', 'social', 'string', true, true),
  ('social.linkedin_url', '', 'LinkedIn page URL', 'social', 'string', true, true),
  ('support.hours', '9:00 AM - 6:00 PM IST', 'Support availability hours', 'support', 'string', true, true),
  ('features.booking_enabled', 'true', 'Enable service bookings', 'features', 'boolean', true, true),
  ('features.maintenance_mode', 'false', 'Show maintenance screen in mobile apps', 'features', 'boolean', true, true),
  ('features.aayojan_enabled', 'true', 'Enable Aayojan events', 'features', 'boolean', true, true),
  ('features.reviews_enabled', 'true', 'Enable reviews', 'features', 'boolean', true, true),
  ('features.coupons_enabled', 'true', 'Enable coupons', 'features', 'boolean', true, true),
  ('features.chat_enabled', 'false', 'Enable in-app chat', 'features', 'boolean', true, true),
  ('features.wallet_enabled', 'false', 'Enable wallet', 'features', 'boolean', true, true),
  ('notifications.push_enabled', 'true', 'Enable push notifications', 'notifications', 'boolean', true, true),
  ('notifications.email_enabled', 'true', 'Enable email notifications', 'notifications', 'boolean', false, true),
  ('notifications.sms_enabled', 'true', 'Enable SMS notifications', 'notifications', 'boolean', false, true),
  ('notifications.promotional_enabled', 'true', 'Allow promotional push campaigns', 'notifications', 'boolean', true, true),
  ('media.max_image_count', '5', 'Max images per upload group', 'media', 'number', true, true),
  ('media.allowed_image_types', 'jpeg,png,webp,gif', 'Allowed image MIME subtypes', 'media', 'string', true, true),
  ('convenience_fee', '0', 'Checkout convenience fee amount', 'booking', 'number', true, true),
  ('booking.cancellation_hours', '24', 'Hours before service when free cancel ends', 'booking', 'number', true, true),
  ('booking.max_members', '10', 'Max members per booking', 'booking', 'number', true, true),
  ('location.default_city', 'Indore', 'Default city for discovery', 'location', 'string', true, true),
  ('location.default_lat', '22.7196', 'Default map latitude', 'location', 'number', true, true),
  ('location.default_lng', '75.8577', 'Default map longitude', 'location', 'number', true, true),
  ('location.search_radius_km', '50', 'Default search radius in km', 'location', 'number', true, true),
  ('security.session_timeout_minutes', '43200', 'JWT / session soft timeout hint (minutes)', 'security', 'number', false, true),
  ('behaviour.home_refresh_seconds', '60', 'Suggested home refresh interval', 'behaviour', 'number', true, true),
  ('behaviour.cache_ttl_seconds', '60', 'Suggested client settings cache TTL', 'behaviour', 'number', true, true),
  ('stats_pujas_completed', '0', 'Home screen completed pujas count', 'system', 'number', true, true),
  ('stats_connected_pandits', '0', 'Home screen connected pandits count', 'system', 'number', true, true)
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  value_type = EXCLUDED.value_type,
  is_public = EXCLUDED.is_public,
  is_editable = EXCLUDED.is_editable;


-- ============================================================
-- 004: Expand app_settings catalog with remaining product-brief keys
-- ============================================================
INSERT INTO app_settings (key, value, description, category, value_type, is_public, is_editable)
VALUES
  ('android.current_version', '1.0.0', 'Current production Android version label', 'android', 'string', true, true),
  ('ios.current_version', '1.0.0', 'Current production iOS version label', 'ios', 'string', true, true),
  ('general.company_address', '', 'Company address', 'general', 'string', true, true),
  ('general.privacy_policy_url', 'https://yajmanapp.in/privacy', 'Privacy policy URL', 'general', 'string', true, true),
  ('general.terms_url', 'https://yajmanapp.in/terms', 'Terms & conditions URL', 'general', 'string', true, true),
  ('general.about_us_url', 'https://yajmanapp.in/about', 'About us URL', 'general', 'string', true, true),
  ('general.contact_us_url', 'https://yajmanapp.in/contact', 'Contact us URL', 'general', 'string', true, true),
  ('support.telegram_url', '', 'Telegram support link', 'support', 'string', true, true),
  ('support.live_chat_url', '', 'Live chat URL', 'support', 'string', true, true),
  ('support.help_center_url', '', 'Help center URL', 'support', 'string', true, true),
  ('features.notifications_enabled', 'true', 'Enable notification module in app', 'features', 'boolean', true, true),
  ('features.referral_enabled', 'false', 'Enable referral system', 'features', 'boolean', true, true),
  ('features.payments_enabled', 'true', 'Enable online payments', 'features', 'boolean', true, true),
  ('features.offline_mode_enabled', 'false', 'Enable offline mode', 'features', 'boolean', true, true),
  ('features.gps_tracking_enabled', 'false', 'Enable GPS tracking', 'features', 'boolean', true, true),
  ('notifications.system_enabled', 'true', 'Enable system notifications', 'notifications', 'boolean', true, true),
  ('notifications.order_enabled', 'true', 'Enable order notifications', 'notifications', 'boolean', true, true),
  ('notifications.marketing_enabled', 'true', 'Enable marketing notifications', 'notifications', 'boolean', true, true),
  ('media.max_video_size_mb', '50', 'Max video upload size in MB', 'media', 'number', true, true),
  ('media.max_pdf_size_mb', '10', 'Max PDF upload size in MB', 'media', 'number', true, true),
  ('media.allowed_file_types', 'jpeg,png,webp,gif,pdf', 'Allowed upload file types', 'media', 'string', true, true),
  ('booking.reschedule_limit', '2', 'Max reschedules per booking', 'booking', 'number', true, true),
  ('booking.max_future_booking_days', '90', 'How far ahead users can book', 'booking', 'number', true, true),
  ('booking.timeout_minutes', '30', 'Checkout / booking hold timeout', 'booking', 'number', true, true),
  ('location.default_country', 'IN', 'Default country code', 'location', 'string', true, true),
  ('location.default_currency', 'INR', 'Default currency code', 'location', 'string', true, true),
  ('location.default_timezone', 'Asia/Kolkata', 'Default timezone', 'location', 'string', true, true),
  ('security.max_login_attempts', '5', 'Max login / OTP attempts before lockout hint', 'security', 'number', false, true),
  ('security.device_token_expiry_days', '365', 'Suggested device token refresh window', 'security', 'number', false, true),
  ('behaviour.show_intro_screens', 'true', 'Show intro / onboarding screens', 'behaviour', 'boolean', true, true),
  ('behaviour.enable_app_rating_popup', 'true', 'Enable app rating prompt', 'behaviour', 'boolean', true, true),
  ('behaviour.enable_force_logout', 'false', 'Force logout all sessions remotely', 'behaviour', 'boolean', true, true),
  ('behaviour.enable_debug_logs', 'false', 'Enable client debug logs', 'behaviour', 'boolean', false, true),
  ('behaviour.enable_crash_reporting', 'true', 'Enable crash reporting', 'behaviour', 'boolean', true, true),
  ('behaviour.enable_analytics', 'true', 'Enable analytics', 'behaviour', 'boolean', true, true),
  ('behaviour.enable_maintenance_banner', 'false', 'Show maintenance banner', 'behaviour', 'boolean', true, true)
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  value_type = EXCLUDED.value_type,
  is_public = EXCLUDED.is_public,
  is_editable = EXCLUDED.is_editable;


-- ============================================================
-- 005: Add-on catalog
-- ============================================================
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

CREATE TABLE IF NOT EXISTS service_addons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    addon_id UUID NOT NULL REFERENCES addons(id) ON DELETE CASCADE,
    UNIQUE(service_id, addon_id)
);

CREATE TABLE IF NOT EXISTS order_addons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    addon_id UUID REFERENCES addons(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS addon_total DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE services ADD COLUMN IF NOT EXISTS is_addon_available BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_service_addons_service ON service_addons(service_id);
CREATE INDEX IF NOT EXISTS idx_service_addons_addon ON service_addons(addon_id);
CREATE INDEX IF NOT EXISTS idx_order_addons_order ON order_addons(order_id);


-- ============================================================
-- 006: services.benefits
-- ============================================================
ALTER TABLE services ADD COLUMN IF NOT EXISTS benefits TEXT[] NOT NULL DEFAULT '{}';


-- ============================================================
-- 007: services.key_features (flat), drop old child table
-- ============================================================
ALTER TABLE services ADD COLUMN IF NOT EXISTS key_features TEXT[] NOT NULL DEFAULT '{}';
DROP TABLE IF EXISTS service_key_features;


-- ============================================================
-- 008: service availability model + free add-ons
-- ============================================================
ALTER TABLE services DROP COLUMN IF EXISTS location;
ALTER TABLE services DROP COLUMN IF EXISTS city;
ALTER TABLE services DROP COLUMN IF EXISTS state;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'advance_booking_hours'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'advance_booking_days'
  ) THEN
    ALTER TABLE services RENAME COLUMN advance_booking_hours TO advance_booking_days;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'advance_booking_days'
  ) THEN
    ALTER TABLE services ALTER COLUMN advance_booking_days SET DEFAULT 0;
  END IF;
END $$;

ALTER TABLE services ADD COLUMN IF NOT EXISTS availability_start_date DATE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS availability_end_date DATE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS booking_availability_type VARCHAR(20) NOT NULL DEFAULT 'all_day';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'services_booking_availability_type_check'
  ) THEN
    ALTER TABLE services
      ADD CONSTRAINT services_booking_availability_type_check
      CHECK (booking_availability_type IN ('all_day', 'specific_day'));
  END IF;
END $$;

ALTER TABLE services ADD COLUMN IF NOT EXISTS available_dates TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE addons ADD COLUMN IF NOT EXISTS is_free BOOLEAN NOT NULL DEFAULT false;


-- ============================================================
-- 009: category capability flags
-- ============================================================
ALTER TABLE categories ADD COLUMN IF NOT EXISTS requires_pandit BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS requires_payment BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE services ALTER COLUMN price DROP NOT NULL;


-- ============================================================
-- 010: order payment/refund failure enum values
-- (ALTER TYPE ADD VALUE autocommits - do not run this file in a single tx)
-- ============================================================
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'payment_failed';
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'refund_failed';
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'disputed';


-- ============================================================
-- 011: contact inquiry category
-- ============================================================
ALTER TABLE contact_form_entries ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id);
ALTER TABLE contact_form_entries ADD COLUMN IF NOT EXISTS category_name VARCHAR(100);


-- ============================================================
-- 012: aayojan_gallery_images
-- ============================================================
CREATE TABLE IF NOT EXISTS aayojan_gallery_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    image_url TEXT NOT NULL,
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ============================================================
-- 013: analytics_events
-- ============================================================
CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(20) NOT NULL,
    entity_id UUID NOT NULL,
    event_type VARCHAR(20) NOT NULL DEFAULT 'view',
    user_id UUID REFERENCES users(id),
    visitor_hash VARCHAR(64) NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_entity ON analytics_events(entity_type, entity_id, created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_user ON analytics_events(user_id, created_at) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_visitor ON analytics_events(visitor_hash, created_at);


-- ============================================================
-- 014: gallery_images
-- ============================================================
CREATE TABLE IF NOT EXISTS gallery_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    image_url TEXT NOT NULL,
    title VARCHAR(200),
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gallery_images_active ON gallery_images(is_active, display_order);


-- ============================================================
-- 015: categories.requires_booking_time
-- ============================================================
ALTER TABLE categories ADD COLUMN IF NOT EXISTS requires_booking_time BOOLEAN NOT NULL DEFAULT false;

UPDATE categories SET requires_booking_time = true WHERE slug = 'panditji-at-home';


-- ============================================================
-- 016: puja process templates
-- ============================================================
CREATE TABLE IF NOT EXISTS puja_processes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(170) NOT NULL UNIQUE,
    description TEXT,
    display_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_puja_processes_updated ON puja_processes;
CREATE TRIGGER trg_puja_processes_updated
  BEFORE UPDATE ON puja_processes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS puja_process_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    puja_process_id UUID NOT NULL REFERENCES puja_processes(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_puja_process_steps_updated ON puja_process_steps;
CREATE TRIGGER trg_puja_process_steps_updated
  BEFORE UPDATE ON puja_process_steps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_puja_process_steps_process ON puja_process_steps(puja_process_id);
CREATE INDEX IF NOT EXISTS idx_puja_process_steps_order ON puja_process_steps(puja_process_id, display_order);

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS puja_process_id UUID REFERENCES puja_processes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_services_puja_process ON services(puja_process_id);


-- ============================================================
-- 017: services.display_order globally unique
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_services_display_order_unique'
  ) THEN
    WITH ranked AS (
      SELECT id,
        ROW_NUMBER() OVER (ORDER BY display_order ASC, created_at ASC) - 1 AS new_order
      FROM services
    )
    UPDATE services s
    SET display_order = r.new_order
    FROM ranked r
    WHERE s.id = r.id
      AND s.display_order IS DISTINCT FROM r.new_order;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_services_display_order_unique ON services (display_order);


-- ============================================================
-- 018: recommended_services curated placements
-- ============================================================
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


-- ============================================================
-- 019: categories.display_order globally unique
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_categories_display_order_unique'
  ) THEN
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
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_display_order_unique
  ON categories (display_order);


-- ============================================================
-- 020: dynamic legal / content pages
-- ============================================================
CREATE TABLE IF NOT EXISTS legal_pages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    meta_title VARCHAR(200),
    meta_description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_legal_pages_updated ON legal_pages;
CREATE TRIGGER trg_legal_pages_updated
  BEFORE UPDATE ON legal_pages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

INSERT INTO legal_pages (slug, title, content)
VALUES
  ('terms-and-conditions', 'Terms & Conditions', '<p>Add your Terms &amp; Conditions content here.</p>'),
  ('privacy-policy', 'Privacy Policy', '<p>Add your Privacy Policy content here.</p>'),
  ('cookies-policy', 'Cookies Policy', '<p>Add your Cookies Policy content here.</p>'),
  ('disclaimer', 'Disclaimer', '<p>Add your Disclaimer content here.</p>'),
  ('return-policy', 'Return Policy', '<p>Add your Return Policy content here.</p>')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- END
-- ============================================================
