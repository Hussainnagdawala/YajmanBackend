-- 004: Expand app_settings catalog with remaining product-brief keys.
-- Safe to re-run: ON CONFLICT updates metadata only (preserves values).

INSERT INTO app_settings (key, value, description, category, value_type, is_public, is_editable)
VALUES
  -- Version current (display / analytics)
  ('android.current_version', '1.0.0', 'Current production Android version label', 'android', 'string', true, true),
  ('ios.current_version', '1.0.0', 'Current production iOS version label', 'ios', 'string', true, true),

  -- General URLs / company
  ('general.company_address', '', 'Company address', 'general', 'string', true, true),
  ('general.privacy_policy_url', 'https://yajmanapp.in/privacy', 'Privacy policy URL', 'general', 'string', true, true),
  ('general.terms_url', 'https://yajmanapp.in/terms', 'Terms & conditions URL', 'general', 'string', true, true),
  ('general.about_us_url', 'https://yajmanapp.in/about', 'About us URL', 'general', 'string', true, true),
  ('general.contact_us_url', 'https://yajmanapp.in/contact', 'Contact us URL', 'general', 'string', true, true),

  -- Support extras
  ('support.telegram_url', '', 'Telegram support link', 'support', 'string', true, true),
  ('support.live_chat_url', '', 'Live chat URL', 'support', 'string', true, true),
  ('support.help_center_url', '', 'Help center URL', 'support', 'string', true, true),

  -- Feature flags
  ('features.notifications_enabled', 'true', 'Enable notification module in app', 'features', 'boolean', true, true),
  ('features.referral_enabled', 'false', 'Enable referral system', 'features', 'boolean', true, true),
  ('features.payments_enabled', 'true', 'Enable online payments', 'features', 'boolean', true, true),
  ('features.offline_mode_enabled', 'false', 'Enable offline mode', 'features', 'boolean', true, true),
  ('features.gps_tracking_enabled', 'false', 'Enable GPS tracking', 'features', 'boolean', true, true),

  -- Notification toggles
  ('notifications.system_enabled', 'true', 'Enable system notifications', 'notifications', 'boolean', true, true),
  ('notifications.order_enabled', 'true', 'Enable order notifications', 'notifications', 'boolean', true, true),
  ('notifications.marketing_enabled', 'true', 'Enable marketing notifications', 'notifications', 'boolean', true, true),

  -- Media
  ('media.max_video_size_mb', '50', 'Max video upload size in MB', 'media', 'number', true, true),
  ('media.max_pdf_size_mb', '10', 'Max PDF upload size in MB', 'media', 'number', true, true),
  ('media.allowed_file_types', 'jpeg,png,webp,gif,pdf', 'Allowed upload file types', 'media', 'string', true, true),

  -- Booking
  ('booking.reschedule_limit', '2', 'Max reschedules per booking', 'booking', 'number', true, true),
  ('booking.max_future_booking_days', '90', 'How far ahead users can book', 'booking', 'number', true, true),
  ('booking.timeout_minutes', '30', 'Checkout / booking hold timeout', 'booking', 'number', true, true),

  -- Location
  ('location.default_country', 'IN', 'Default country code', 'location', 'string', true, true),
  ('location.default_currency', 'INR', 'Default currency code', 'location', 'string', true, true),
  ('location.default_timezone', 'Asia/Kolkata', 'Default timezone', 'location', 'string', true, true),

  -- Security
  ('security.max_login_attempts', '5', 'Max login / OTP attempts before lockout hint', 'security', 'number', false, true),
  ('security.device_token_expiry_days', '365', 'Suggested device token refresh window', 'security', 'number', false, true),

  -- Behaviour
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
