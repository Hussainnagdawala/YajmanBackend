export type SettingValueType = "string" | "number" | "boolean" | "json";

export type SettingCategory =
  | "general"
  | "social"
  | "support"
  | "features"
  | "notifications"
  | "media"
  | "booking"
  | "location"
  | "security"
  | "behaviour"
  | "android"
  | "ios"
  | "system";

export interface SettingCatalogEntry {
  key: string;
  category: SettingCategory;
  value_type: SettingValueType;
  is_public: boolean;
  is_editable: boolean;
  description: string;
  default_value: string;
}

/** Canonical catalog of known setting keys (Phase 1: reject unknown keys). */
export const SETTINGS_CATALOG: SettingCatalogEntry[] = [
  // Android
  { key: "android.current_version", category: "android", value_type: "string", is_public: true, is_editable: true, description: "Current production Android version label", default_value: "1.0.0" },
  { key: "android.latest_version", category: "android", value_type: "string", is_public: true, is_editable: true, description: "Latest Android app version on Play Store", default_value: "1.0.0" },
  { key: "android.minimum_supported_version", category: "android", value_type: "string", is_public: true, is_editable: true, description: "Minimum Android version allowed without force update", default_value: "1.0.0" },
  { key: "android.force_update", category: "android", value_type: "boolean", is_public: true, is_editable: true, description: "Force all Android users to update", default_value: "false" },
  { key: "android.update_message", category: "android", value_type: "string", is_public: true, is_editable: true, description: "Android update prompt message", default_value: "A new version is available" },
  { key: "android.store_url", category: "android", value_type: "string", is_public: true, is_editable: true, description: "Google Play store URL", default_value: "https://play.google.com/store/apps/details?id=in.yajman.app" },

  // iOS
  { key: "ios.current_version", category: "ios", value_type: "string", is_public: true, is_editable: true, description: "Current production iOS version label", default_value: "1.0.0" },
  { key: "ios.latest_version", category: "ios", value_type: "string", is_public: true, is_editable: true, description: "Latest iOS app version on App Store", default_value: "1.0.0" },
  { key: "ios.minimum_supported_version", category: "ios", value_type: "string", is_public: true, is_editable: true, description: "Minimum iOS version allowed without force update", default_value: "1.0.0" },
  { key: "ios.force_update", category: "ios", value_type: "boolean", is_public: true, is_editable: true, description: "Force all iOS users to update", default_value: "false" },
  { key: "ios.update_message", category: "ios", value_type: "string", is_public: true, is_editable: true, description: "iOS update prompt message", default_value: "A new version is available" },
  { key: "ios.store_url", category: "ios", value_type: "string", is_public: true, is_editable: true, description: "Apple App Store URL", default_value: "https://apps.apple.com/app/id000000000" },

  // General
  { key: "general.app_name", category: "general", value_type: "string", is_public: true, is_editable: true, description: "App display name", default_value: "Yajman" },
  { key: "general.app_tagline", category: "general", value_type: "string", is_public: true, is_editable: true, description: "App tagline", default_value: "Book pandits for every occasion" },
  { key: "general.website_url", category: "general", value_type: "string", is_public: true, is_editable: true, description: "Marketing website URL", default_value: "https://yajmanapp.in" },
  { key: "general.company_address", category: "general", value_type: "string", is_public: true, is_editable: true, description: "Company address", default_value: "" },
  { key: "general.privacy_policy_url", category: "general", value_type: "string", is_public: true, is_editable: true, description: "Privacy policy URL", default_value: "https://yajmanapp.in/privacy" },
  { key: "general.terms_url", category: "general", value_type: "string", is_public: true, is_editable: true, description: "Terms & conditions URL", default_value: "https://yajmanapp.in/terms" },
  { key: "general.about_us_url", category: "general", value_type: "string", is_public: true, is_editable: true, description: "About us URL", default_value: "https://yajmanapp.in/about" },
  { key: "general.contact_us_url", category: "general", value_type: "string", is_public: true, is_editable: true, description: "Contact us URL", default_value: "https://yajmanapp.in/contact" },
  { key: "general.maintenance_message", category: "general", value_type: "string", is_public: true, is_editable: true, description: "Message shown during maintenance mode", default_value: "" },

  // Social
  { key: "social.facebook_url", category: "social", value_type: "string", is_public: true, is_editable: true, description: "Facebook page URL", default_value: "" },
  { key: "social.instagram_url", category: "social", value_type: "string", is_public: true, is_editable: true, description: "Instagram profile URL", default_value: "" },
  { key: "social.youtube_url", category: "social", value_type: "string", is_public: true, is_editable: true, description: "YouTube channel URL", default_value: "" },
  { key: "social.twitter_url", category: "social", value_type: "string", is_public: true, is_editable: true, description: "X / Twitter profile URL", default_value: "" },
  { key: "social.linkedin_url", category: "social", value_type: "string", is_public: true, is_editable: true, description: "LinkedIn page URL", default_value: "" },

  // Support
  { key: "support_phone", category: "support", value_type: "string", is_public: true, is_editable: true, description: "Support phone number", default_value: "+918109181057" },
  { key: "support_email", category: "support", value_type: "string", is_public: true, is_editable: true, description: "Support email", default_value: "contact@yajmanapp.in" },
  { key: "support_whatsapp", category: "support", value_type: "string", is_public: true, is_editable: true, description: "WhatsApp support number", default_value: "+918109181057" },
  { key: "support.hours", category: "support", value_type: "string", is_public: true, is_editable: true, description: "Support availability hours", default_value: "9:00 AM - 6:00 PM IST" },
  { key: "support.telegram_url", category: "support", value_type: "string", is_public: true, is_editable: true, description: "Telegram support link", default_value: "" },
  { key: "support.live_chat_url", category: "support", value_type: "string", is_public: true, is_editable: true, description: "Live chat URL", default_value: "" },
  { key: "support.help_center_url", category: "support", value_type: "string", is_public: true, is_editable: true, description: "Help center URL", default_value: "" },

  // Features
  { key: "features.booking_enabled", category: "features", value_type: "boolean", is_public: true, is_editable: true, description: "Enable service bookings", default_value: "true" },
  { key: "features.maintenance_mode", category: "features", value_type: "boolean", is_public: true, is_editable: true, description: "Show maintenance screen in mobile apps", default_value: "false" },
  { key: "features.aayojan_enabled", category: "features", value_type: "boolean", is_public: true, is_editable: true, description: "Enable Aayojan events", default_value: "true" },
  { key: "features.reviews_enabled", category: "features", value_type: "boolean", is_public: true, is_editable: true, description: "Enable reviews", default_value: "true" },
  { key: "features.coupons_enabled", category: "features", value_type: "boolean", is_public: true, is_editable: true, description: "Enable coupons", default_value: "true" },
  { key: "features.chat_enabled", category: "features", value_type: "boolean", is_public: true, is_editable: true, description: "Enable in-app chat", default_value: "false" },
  { key: "features.wallet_enabled", category: "features", value_type: "boolean", is_public: true, is_editable: true, description: "Enable wallet", default_value: "false" },
  { key: "features.notifications_enabled", category: "features", value_type: "boolean", is_public: true, is_editable: true, description: "Enable notification module in app", default_value: "true" },
  { key: "features.referral_enabled", category: "features", value_type: "boolean", is_public: true, is_editable: true, description: "Enable referral system", default_value: "false" },
  { key: "features.payments_enabled", category: "features", value_type: "boolean", is_public: true, is_editable: true, description: "Enable online payments", default_value: "true" },
  { key: "features.offline_mode_enabled", category: "features", value_type: "boolean", is_public: true, is_editable: true, description: "Enable offline mode", default_value: "false" },
  { key: "features.gps_tracking_enabled", category: "features", value_type: "boolean", is_public: true, is_editable: true, description: "Enable GPS tracking", default_value: "false" },

  // Notifications
  { key: "notifications.push_enabled", category: "notifications", value_type: "boolean", is_public: true, is_editable: true, description: "Enable push notifications", default_value: "true" },
  { key: "notifications.email_enabled", category: "notifications", value_type: "boolean", is_public: false, is_editable: true, description: "Enable email notifications", default_value: "true" },
  { key: "notifications.sms_enabled", category: "notifications", value_type: "boolean", is_public: false, is_editable: true, description: "Enable SMS notifications", default_value: "true" },
  { key: "notifications.promotional_enabled", category: "notifications", value_type: "boolean", is_public: true, is_editable: true, description: "Allow promotional push campaigns", default_value: "true" },
  { key: "notifications.system_enabled", category: "notifications", value_type: "boolean", is_public: true, is_editable: true, description: "Enable system notifications", default_value: "true" },
  { key: "notifications.order_enabled", category: "notifications", value_type: "boolean", is_public: true, is_editable: true, description: "Enable order notifications", default_value: "true" },
  { key: "notifications.marketing_enabled", category: "notifications", value_type: "boolean", is_public: true, is_editable: true, description: "Enable marketing notifications", default_value: "true" },

  // Media
  { key: "max_upload_size_mb", category: "media", value_type: "number", is_public: true, is_editable: true, description: "Max file upload size in MB", default_value: "10" },
  { key: "media.max_image_count", category: "media", value_type: "number", is_public: true, is_editable: true, description: "Max images per upload group", default_value: "5" },
  { key: "media.allowed_image_types", category: "media", value_type: "string", is_public: true, is_editable: true, description: "Allowed image MIME subtypes", default_value: "jpeg,png,webp,gif" },
  { key: "media.max_video_size_mb", category: "media", value_type: "number", is_public: true, is_editable: true, description: "Max video upload size in MB", default_value: "50" },
  { key: "media.max_pdf_size_mb", category: "media", value_type: "number", is_public: true, is_editable: true, description: "Max PDF upload size in MB", default_value: "10" },
  { key: "media.allowed_file_types", category: "media", value_type: "string", is_public: true, is_editable: true, description: "Allowed upload file types", default_value: "jpeg,png,webp,gif,pdf" },

  // Booking
  { key: "booking_advance_hours", category: "booking", value_type: "number", is_public: true, is_editable: true, description: "Minimum hours before service for booking", default_value: "24" },
  { key: "pandit_response_hours", category: "booking", value_type: "number", is_public: false, is_editable: true, description: "Hours pandit has to accept/reject assignment", default_value: "48" },
  { key: "convenience_fee", category: "booking", value_type: "number", is_public: true, is_editable: true, description: "Checkout convenience fee amount", default_value: "0" },
  { key: "booking.cancellation_hours", category: "booking", value_type: "number", is_public: true, is_editable: true, description: "Hours before service when free cancel ends", default_value: "24" },
  { key: "booking.max_members", category: "booking", value_type: "number", is_public: true, is_editable: true, description: "Max members per booking", default_value: "10" },
  { key: "booking.reschedule_limit", category: "booking", value_type: "number", is_public: true, is_editable: true, description: "Max reschedules per booking", default_value: "2" },
  { key: "booking.max_future_booking_days", category: "booking", value_type: "number", is_public: true, is_editable: true, description: "How far ahead users can book", default_value: "90" },
  { key: "booking.timeout_minutes", category: "booking", value_type: "number", is_public: true, is_editable: true, description: "Checkout / booking hold timeout", default_value: "30" },

  // Location
  { key: "location.default_city", category: "location", value_type: "string", is_public: true, is_editable: true, description: "Default city for discovery", default_value: "Indore" },
  { key: "location.default_lat", category: "location", value_type: "number", is_public: true, is_editable: true, description: "Default map latitude", default_value: "22.7196" },
  { key: "location.default_lng", category: "location", value_type: "number", is_public: true, is_editable: true, description: "Default map longitude", default_value: "75.8577" },
  { key: "location.search_radius_km", category: "location", value_type: "number", is_public: true, is_editable: true, description: "Default search radius in km", default_value: "50" },
  { key: "location.default_country", category: "location", value_type: "string", is_public: true, is_editable: true, description: "Default country code", default_value: "IN" },
  { key: "location.default_currency", category: "location", value_type: "string", is_public: true, is_editable: true, description: "Default currency code", default_value: "INR" },
  { key: "location.default_timezone", category: "location", value_type: "string", is_public: true, is_editable: true, description: "Default timezone", default_value: "Asia/Kolkata" },

  // Security
  { key: "otp_expiry_minutes", category: "security", value_type: "number", is_public: false, is_editable: true, description: "OTP code expiry in minutes", default_value: "10" },
  { key: "max_otp_attempts", category: "security", value_type: "number", is_public: false, is_editable: true, description: "Max OTP verification attempts", default_value: "5" },
  { key: "security.session_timeout_minutes", category: "security", value_type: "number", is_public: false, is_editable: true, description: "JWT / session soft timeout hint (minutes)", default_value: "43200" },
  { key: "security.max_login_attempts", category: "security", value_type: "number", is_public: false, is_editable: true, description: "Max login / OTP attempts before lockout hint", default_value: "5" },
  { key: "security.device_token_expiry_days", category: "security", value_type: "number", is_public: false, is_editable: true, description: "Suggested device token refresh window", default_value: "365" },

  // Behaviour
  { key: "behaviour.home_refresh_seconds", category: "behaviour", value_type: "number", is_public: true, is_editable: true, description: "Suggested home refresh interval", default_value: "60" },
  { key: "behaviour.cache_ttl_seconds", category: "behaviour", value_type: "number", is_public: true, is_editable: true, description: "Suggested client settings cache TTL", default_value: "60" },
  { key: "behaviour.show_intro_screens", category: "behaviour", value_type: "boolean", is_public: true, is_editable: true, description: "Show intro / onboarding screens", default_value: "true" },
  { key: "behaviour.enable_app_rating_popup", category: "behaviour", value_type: "boolean", is_public: true, is_editable: true, description: "Enable app rating prompt", default_value: "true" },
  { key: "behaviour.enable_force_logout", category: "behaviour", value_type: "boolean", is_public: true, is_editable: true, description: "Force logout all sessions remotely", default_value: "false" },
  { key: "behaviour.enable_debug_logs", category: "behaviour", value_type: "boolean", is_public: false, is_editable: true, description: "Enable client debug logs", default_value: "false" },
  { key: "behaviour.enable_crash_reporting", category: "behaviour", value_type: "boolean", is_public: true, is_editable: true, description: "Enable crash reporting", default_value: "true" },
  { key: "behaviour.enable_analytics", category: "behaviour", value_type: "boolean", is_public: true, is_editable: true, description: "Enable analytics", default_value: "true" },
  { key: "behaviour.enable_maintenance_banner", category: "behaviour", value_type: "boolean", is_public: true, is_editable: true, description: "Show maintenance banner", default_value: "false" },

  // System
  { key: "razorpay_key_id", category: "system", value_type: "string", is_public: false, is_editable: false, description: "Razorpay API key ID", default_value: "" },
  { key: "razorpay_key_secret", category: "system", value_type: "string", is_public: false, is_editable: false, description: "Razorpay API key secret", default_value: "" },
  { key: "s3_bucket", category: "system", value_type: "string", is_public: false, is_editable: false, description: "S3 bucket name", default_value: "yajman-uploads" },
  { key: "s3_region", category: "system", value_type: "string", is_public: false, is_editable: false, description: "S3 region", default_value: "ap-south-1" },
  { key: "invoice_prefix", category: "system", value_type: "string", is_public: false, is_editable: true, description: "Invoice number prefix", default_value: "INV" },
  { key: "order_prefix", category: "system", value_type: "string", is_public: false, is_editable: true, description: "Order number prefix", default_value: "YAJ" },
  { key: "stats_pujas_completed", category: "system", value_type: "number", is_public: true, is_editable: true, description: "Home screen completed pujas count", default_value: "0" },
  { key: "stats_connected_pandits", category: "system", value_type: "number", is_public: true, is_editable: true, description: "Home screen connected pandits count", default_value: "0" },
];

export const SETTINGS_BY_KEY = new Map(SETTINGS_CATALOG.map((s) => [s.key, s]));

export const SETTING_CATEGORIES: SettingCategory[] = [
  "general",
  "android",
  "ios",
  "features",
  "support",
  "social",
  "notifications",
  "media",
  "booking",
  "location",
  "security",
  "behaviour",
  "system",
];
