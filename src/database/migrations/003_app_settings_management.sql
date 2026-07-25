-- 003_app_settings_management.sql
-- Extend app_settings with category / typing / visibility flags and seed catalog.

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

-- Backfill existing legacy keys
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

-- Seed / upsert full catalog (new + ensure legacy convenience / stats keys exist)
INSERT INTO app_settings (key, value, description, category, value_type, is_public, is_editable)
VALUES
  -- Android
  ('android.latest_version', '1.0.0', 'Latest Android app version on Play Store', 'android', 'string', true, true),
  ('android.minimum_supported_version', '1.0.0', 'Minimum Android version allowed without force update', 'android', 'string', true, true),
  ('android.force_update', 'false', 'Force all Android users to update', 'android', 'boolean', true, true),
  ('android.update_message', 'A new version is available', 'Android update prompt message', 'android', 'string', true, true),
  ('android.store_url', 'https://play.google.com/store/apps/details?id=in.yajman.app', 'Google Play store URL', 'android', 'string', true, true),

  -- iOS
  ('ios.latest_version', '1.0.0', 'Latest iOS app version on App Store', 'ios', 'string', true, true),
  ('ios.minimum_supported_version', '1.0.0', 'Minimum iOS version allowed without force update', 'ios', 'string', true, true),
  ('ios.force_update', 'false', 'Force all iOS users to update', 'ios', 'boolean', true, true),
  ('ios.update_message', 'A new version is available', 'iOS update prompt message', 'ios', 'string', true, true),
  ('ios.store_url', 'https://apps.apple.com/app/id000000000', 'Apple App Store URL', 'ios', 'string', true, true),

  -- General
  ('general.app_name', 'Yajman', 'App display name', 'general', 'string', true, true),
  ('general.app_tagline', 'Book pandits for every occasion', 'App tagline', 'general', 'string', true, true),
  ('general.website_url', 'https://yajmanapp.in', 'Marketing website URL', 'general', 'string', true, true),
  ('general.maintenance_message', '', 'Message shown during maintenance mode', 'general', 'string', true, true),

  -- Social
  ('social.facebook_url', '', 'Facebook page URL', 'social', 'string', true, true),
  ('social.instagram_url', '', 'Instagram profile URL', 'social', 'string', true, true),
  ('social.youtube_url', '', 'YouTube channel URL', 'social', 'string', true, true),
  ('social.twitter_url', '', 'X / Twitter profile URL', 'social', 'string', true, true),
  ('social.linkedin_url', '', 'LinkedIn page URL', 'social', 'string', true, true),

  -- Support extras
  ('support.hours', '9:00 AM - 6:00 PM IST', 'Support availability hours', 'support', 'string', true, true),

  -- Features
  ('features.booking_enabled', 'true', 'Enable service bookings', 'features', 'boolean', true, true),
  ('features.maintenance_mode', 'false', 'Show maintenance screen in mobile apps', 'features', 'boolean', true, true),
  ('features.aayojan_enabled', 'true', 'Enable Aayojan events', 'features', 'boolean', true, true),
  ('features.reviews_enabled', 'true', 'Enable reviews', 'features', 'boolean', true, true),
  ('features.coupons_enabled', 'true', 'Enable coupons', 'features', 'boolean', true, true),
  ('features.chat_enabled', 'false', 'Enable in-app chat', 'features', 'boolean', true, true),
  ('features.wallet_enabled', 'false', 'Enable wallet', 'features', 'boolean', true, true),

  -- Notifications
  ('notifications.push_enabled', 'true', 'Enable push notifications', 'notifications', 'boolean', true, true),
  ('notifications.email_enabled', 'true', 'Enable email notifications', 'notifications', 'boolean', false, true),
  ('notifications.sms_enabled', 'true', 'Enable SMS notifications', 'notifications', 'boolean', false, true),
  ('notifications.promotional_enabled', 'true', 'Allow promotional push campaigns', 'notifications', 'boolean', true, true),

  -- Media
  ('media.max_image_count', '5', 'Max images per upload group', 'media', 'number', true, true),
  ('media.allowed_image_types', 'jpeg,png,webp,gif', 'Allowed image MIME subtypes', 'media', 'string', true, true),

  -- Booking
  ('convenience_fee', '0', 'Checkout convenience fee amount', 'booking', 'number', true, true),
  ('booking.cancellation_hours', '24', 'Hours before service when free cancel ends', 'booking', 'number', true, true),
  ('booking.max_members', '10', 'Max members per booking', 'booking', 'number', true, true),

  -- Location
  ('location.default_city', 'Indore', 'Default city for discovery', 'location', 'string', true, true),
  ('location.default_lat', '22.7196', 'Default map latitude', 'location', 'number', true, true),
  ('location.default_lng', '75.8577', 'Default map longitude', 'location', 'number', true, true),
  ('location.search_radius_km', '50', 'Default search radius in km', 'location', 'number', true, true),

  -- Security
  ('security.session_timeout_minutes', '43200', 'JWT / session soft timeout hint (minutes)', 'security', 'number', false, true),

  -- Behaviour
  ('behaviour.home_refresh_seconds', '60', 'Suggested home refresh interval', 'behaviour', 'number', true, true),
  ('behaviour.cache_ttl_seconds', '60', 'Suggested client settings cache TTL', 'behaviour', 'number', true, true),

  -- System / home stats
  ('stats_pujas_completed', '0', 'Home screen completed pujas count', 'system', 'number', true, true),
  ('stats_connected_pandits', '0', 'Home screen connected pandits count', 'system', 'number', true, true)
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  value_type = EXCLUDED.value_type,
  is_public = EXCLUDED.is_public,
  is_editable = EXCLUDED.is_editable;
  -- note: value is NOT overwritten on conflict so existing runtime values are preserved
