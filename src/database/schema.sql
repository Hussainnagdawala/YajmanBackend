-- ============================================================
-- YAJMAN — Complete PostgreSQL Database Schema
-- Node.js + Express + PostgreSQL
-- ============================================================
-- Run in order. All tables, indexes, enums, triggers included.
-- ============================================================

-- ─── EXTENSIONS ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── ENUMS ──────────────────────────────────────────────────

CREATE TYPE user_role AS ENUM ('customer', 'pandit', 'admin');
CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended');
CREATE TYPE booking_status AS ENUM (
  'pending', 'confirmed', 'pandit_assigned', 'in_progress', 'completed', 'cancelled', 'refunded',
  'payment_failed', 'refund_failed', 'disputed'
);
CREATE TYPE payment_status AS ENUM ('pending', 'created', 'authorized', 'captured', 'failed', 'refunded');
CREATE TYPE pandit_assignment_status AS ENUM ('pending', 'accepted', 'rejected', 'expired', 'completed');
CREATE TYPE coupon_discount_type AS ENUM ('percentage', 'fixed');
CREATE TYPE content_status AS ENUM ('draft', 'published', 'archived');
CREATE TYPE contact_form_type AS ENUM ('general', 'service', 'aayojan');
CREATE TYPE banner_position AS ENUM ('hero_slider', 'middle_ad', 'offer_banner', 'category_banner');
CREATE TYPE device_source AS ENUM ('web', 'app', 'portal');
CREATE TYPE notification_target_type AS ENUM ('all', 'selected', 'group', 'topic');
CREATE TYPE notification_campaign_status AS ENUM (
  'draft', 'scheduled', 'sending', 'sent', 'cancelled', 'failed'
);
CREATE TYPE notification_delivery_status AS ENUM (
  'pending', 'sent', 'delivered', 'failed', 'skipped'
);
CREATE TYPE device_platform AS ENUM ('web', 'android', 'ios');

-- ============================================================
-- 1. USERS & AUTH
-- ============================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone VARCHAR(15) NOT NULL UNIQUE,
    country_code VARCHAR(5) NOT NULL DEFAULT '+91',
    name VARCHAR(100),
    email VARCHAR(150),
    avatar_url TEXT,
    role user_role NOT NULL DEFAULT 'customer',
    status user_status NOT NULL DEFAULT 'active',
    whatsapp_number VARCHAR(15),
    calling_number VARCHAR(15),
    gender VARCHAR(10),
    date_of_birth DATE,
    time_of_birth TIME,
    place_of_birth VARCHAR(150),
    device_source device_source DEFAULT 'web',
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);

-- OTP verification table (ephemeral, clean old rows via cron)
CREATE TABLE otp_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone VARCHAR(15) NOT NULL,
    country_code VARCHAR(5) NOT NULL DEFAULT '+91',
    otp_code VARCHAR(6) NOT NULL,
    purpose VARCHAR(20) NOT NULL DEFAULT 'login', -- login, verify_phone
    attempts INT DEFAULT 0,
    max_attempts INT DEFAULT 5,
    is_verified BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_otp_phone ON otp_verifications(phone, purpose);
CREATE INDEX idx_otp_expires ON otp_verifications(expires_at);

-- Refresh tokens for session management
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    device_info JSONB,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_refresh_user ON refresh_tokens(user_id);

-- Push notification device tokens (FCM/APNs/Web Push)
CREATE TABLE device_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    platform device_platform NOT NULL,
    device_info JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_device_tokens_user ON device_tokens(user_id, is_active);

-- ============================================================
-- 2. PANDIT PROFILES
-- ============================================================

CREATE TABLE pandit_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    display_name VARCHAR(100) NOT NULL,
    bio TEXT,
    experience_years INT DEFAULT 0,
    specializations TEXT[], -- array of specialization strings
    languages TEXT[],
    profile_image_url TEXT,
    aadhaar_number VARCHAR(12),
    is_verified BOOLEAN DEFAULT FALSE,
    is_available BOOLEAN DEFAULT TRUE,
    rating_avg DECIMAL(3,2) DEFAULT 0.00,
    total_reviews INT DEFAULT 0,
    total_bookings INT DEFAULT 0,
    service_areas TEXT[], -- city names
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_pandit_user ON pandit_profiles(user_id);
CREATE INDEX idx_pandit_available ON pandit_profiles(is_available, is_verified);

-- ============================================================
-- 3. CATEGORIES, TYPES, TAGS (dynamic, admin-managed)
-- ============================================================

-- Categories: Puja At Home, E-Puja, Premium Puja, Astrology, Aarti & Katha, etc.
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(120) NOT NULL UNIQUE,
    description TEXT,
    image_url TEXT,
    icon_url TEXT,
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    requires_pandit BOOLEAN NOT NULL DEFAULT TRUE,
    requires_payment BOOLEAN NOT NULL DEFAULT TRUE,
    requires_booking_time BOOLEAN NOT NULL DEFAULT FALSE,
    meta_title VARCHAR(200),
    meta_description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_categories_display_order_unique ON categories (display_order);

-- Types: Health, Marriage, Business, Navgrah, Festival, etc.
CREATE TABLE types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(120) NOT NULL UNIQUE,
    description TEXT,
    image_url TEXT,
    icon_url TEXT,
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Many-to-many: categories can have multiple types
CREATE TABLE category_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    type_id UUID NOT NULL REFERENCES types(id) ON DELETE CASCADE,
    UNIQUE(category_id, type_id)
);

-- Tags: Featured, Upcoming, Best Seller, New, etc.
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL UNIQUE,
    slug VARCHAR(60) NOT NULL UNIQUE,
    color VARCHAR(7), -- hex color for badge
    bg_color VARCHAR(7),
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 4. PUJA PROCESSES (reusable step templates)
-- ============================================================

CREATE TABLE puja_processes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(170) NOT NULL UNIQUE,
    description TEXT,
    display_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE puja_process_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    puja_process_id UUID NOT NULL REFERENCES puja_processes(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_puja_process_steps_process ON puja_process_steps(puja_process_id);
CREATE INDEX idx_puja_process_steps_order ON puja_process_steps(puja_process_id, display_order);

-- ============================================================
-- 5. SERVICES (main entity)
-- ============================================================

CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(200) NOT NULL,
    slug VARCHAR(250) NOT NULL UNIQUE,
    category_id UUID NOT NULL REFERENCES categories(id),
    type_id UUID REFERENCES types(id),

    -- Pricing
    price DECIMAL(10,2),
    original_price DECIMAL(10,2), -- strikethrough price (NULL = no discount)
    discount_percent INT, -- auto-calculated or manual

    -- Content
    short_description TEXT,
    about_puja TEXT, -- "About this Puja" section
    description TEXT, -- detailed description
    custom_content TEXT, -- rich HTML from text editor (optional)
    benefits TEXT[] NOT NULL DEFAULT '{}',
    key_features TEXT[] NOT NULL DEFAULT '{}',

    -- Location (pincode/coordinates only; city/state removed)
    pincode VARCHAR(10),
    latitude DECIMAL(10,7),
    longitude DECIMAL(10,7),

    -- Media
    feature_image_url TEXT NOT NULL,
    video_url TEXT,

    -- Duration & scheduling
    duration_minutes INT,
    advance_booking_days INT DEFAULT 0,
    availability_start_date DATE,
    availability_end_date DATE,
    booking_availability_type VARCHAR(20) NOT NULL DEFAULT 'all_day'
        CHECK (booking_availability_type IN ('all_day', 'specific_day')),
    available_dates TEXT[] NOT NULL DEFAULT '{}',

    -- Flags
    is_active BOOLEAN DEFAULT TRUE,
    is_featured BOOLEAN DEFAULT FALSE,
    is_bestseller BOOLEAN DEFAULT FALSE,
    is_addon_available BOOLEAN NOT NULL DEFAULT FALSE,

    -- Puja process template (optional)
    puja_process_id UUID REFERENCES puja_processes(id) ON DELETE SET NULL,

    -- SEO
    meta_title VARCHAR(200),
    meta_description TEXT,

    -- Stats
    rating_avg DECIMAL(3,2) DEFAULT 0.00,
    total_reviews INT DEFAULT 0,
    total_bookings INT DEFAULT 0,
    view_count INT DEFAULT 0,

    -- Display
    display_order INT DEFAULT 0,
    status content_status DEFAULT 'published',

    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_services_category ON services(category_id);
CREATE INDEX idx_services_type ON services(type_id);
CREATE INDEX idx_services_slug ON services(slug);
CREATE INDEX idx_services_active ON services(is_active, status);
CREATE INDEX idx_services_featured ON services(is_featured) WHERE is_featured = TRUE;
CREATE INDEX idx_services_price ON services(price);
CREATE INDEX idx_services_rating ON services(rating_avg DESC);
CREATE INDEX idx_services_puja_process ON services(puja_process_id);
CREATE UNIQUE INDEX idx_services_display_order_unique ON services (display_order);

-- Service-tag junction (many-to-many)
CREATE TABLE service_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    UNIQUE(service_id, tag_id)
);

-- Service images (gallery)
CREATE TABLE service_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    thumbnail_url TEXT,
    alt_text VARCHAR(200),
    display_order INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_service_images ON service_images(service_id);

-- Temple details (optional, linked to service)
CREATE TABLE temples (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(250) NOT NULL UNIQUE,
    description TEXT,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    image_url TEXT,
    latitude DECIMAL(10,7),
    longitude DECIMAL(10,7),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE service_temples (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    temple_id UUID NOT NULL REFERENCES temples(id) ON DELETE CASCADE,
    UNIQUE(service_id, temple_id)
);

-- Package details (optional items included in service)
CREATE TABLE service_packages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    items JSONB, -- array of included items: [{name, quantity, unit}]
    price DECIMAL(10,2),
    display_order INT DEFAULT 0
);

-- FAQs per service
CREATE TABLE service_faqs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE
);

-- Service types junction (service can belong to multiple types)
CREATE TABLE service_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    type_id UUID NOT NULL REFERENCES types(id) ON DELETE CASCADE,
    UNIQUE(service_id, type_id)
);

-- ============================================================
-- 5b. ADDONS (checkout extras)
-- ============================================================

CREATE TABLE addons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(120) NOT NULL UNIQUE,
    image_url TEXT,
    price DECIMAL(10,2) NOT NULL,
    is_free BOOLEAN NOT NULL DEFAULT FALSE,
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE service_addons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    addon_id UUID NOT NULL REFERENCES addons(id) ON DELETE CASCADE,
    UNIQUE(service_id, addon_id)
);

CREATE INDEX idx_service_addons_service ON service_addons(service_id);
CREATE INDEX idx_service_addons_addon ON service_addons(addon_id);

-- ============================================================
-- 6. REVIEWS
-- ============================================================

CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    booking_id UUID, -- linked to specific booking (set after booking table created)
    pandit_id UUID REFERENCES pandit_profiles(id),
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title VARCHAR(200),
    comment TEXT,
    is_verified BOOLEAN DEFAULT FALSE, -- verified = from actual booking
    is_approved BOOLEAN DEFAULT TRUE, -- admin moderation
    admin_reply TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_reviews_service ON reviews(service_id);
CREATE INDEX idx_reviews_user ON reviews(user_id);
CREATE INDEX idx_reviews_rating ON reviews(rating);

-- Review photos
CREATE TABLE review_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 6. HOME PAGE DYNAMIC CONTENT
-- ============================================================

-- Popular searches (admin-managed)
CREATE TABLE popular_searches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    label VARCHAR(100) NOT NULL,
    slug VARCHAR(120),
    link_url VARCHAR(500),
    display_order INT DEFAULT 0,
    row_number INT DEFAULT 1, -- row 1 = tag chips, row 2 = text links
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Banners (hero slider, middle ads, offer banners)
CREATE TABLE banners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(200),
    subtitle TEXT,
    description TEXT,
    image_url TEXT NOT NULL,
    mobile_image_url TEXT,
    link_url VARCHAR(500),
    cta_text VARCHAR(50),
    position banner_position NOT NULL,
    discount_text VARCHAR(50), -- "50% Off" etc.
    bg_color VARCHAR(7),
    text_color VARCHAR(7),
    display_order INT DEFAULT 0,
    starts_at TIMESTAMP WITH TIME ZONE,
    ends_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_banners_position ON banners(position, is_active);
CREATE INDEX idx_banners_dates ON banners(starts_at, ends_at);

-- Testimonials (shared across home + aayojan)
CREATE TABLE testimonials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    author_name VARCHAR(100) NOT NULL,
    author_designation VARCHAR(100),
    author_avatar_url TEXT,
    quote TEXT NOT NULL,
    rating INT CHECK (rating >= 1 AND rating <= 5),
    page VARCHAR(50) DEFAULT 'home', -- home, aayojan
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Recommended services (curated by admin)
CREATE TABLE recommended_services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    page VARCHAR(50) DEFAULT 'home', -- home, articles, blogs, aayojan
    section VARCHAR(50) DEFAULT 'recommended', -- recommended, bestseller, premium
    label VARCHAR(100),
    cta_text VARCHAR(50),
    display_order INT DEFAULT 0,
    starts_at TIMESTAMP WITH TIME ZONE,
    ends_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(service_id, page, section)
);

CREATE UNIQUE INDEX idx_recommended_services_page_section_order
  ON recommended_services (page, section, display_order)
  WHERE is_active = true;

CREATE INDEX idx_recommended_services_lookup
  ON recommended_services (page, section, is_active, display_order);

-- ============================================================
-- 7. AAYOJAN (Event Planning)
-- ============================================================

-- Aayojan page content (dynamic text, images, ads)
CREATE TABLE aayojan_page_content (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    section_key VARCHAR(50) NOT NULL UNIQUE, -- hero, about, features, cta
    title VARCHAR(200),
    subtitle TEXT,
    description TEXT,
    image_url TEXT,
    cta_text VARCHAR(100),
    cta_link VARCHAR(500),
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Aayojan event services
CREATE TABLE aayojan_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(200) NOT NULL,
    slug VARCHAR(250) NOT NULL UNIQUE,
    description TEXT,
    short_description TEXT,
    feature_image_url TEXT,
    location VARCHAR(200),
    city VARCHAR(100),
    event_date DATE,
    event_time TIME,
    price DECIMAL(10,2),
    original_price DECIMAL(10,2),
    max_capacity INT,
    rating_avg DECIMAL(3,2) DEFAULT 0.00,
    total_reviews INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    status content_status DEFAULT 'published',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Aayojan event images
CREATE TABLE aayojan_event_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES aayojan_events(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    display_order INT DEFAULT 0
);

-- Aayojan event reviews
CREATE TABLE aayojan_event_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES aayojan_events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    is_approved BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Aayojan ad banners
CREATE TABLE aayojan_banners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(200),
    image_url TEXT NOT NULL,
    link_url VARCHAR(500),
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Aayojan page-level image gallery (not tied to a specific event)
CREATE TABLE aayojan_gallery_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    image_url TEXT NOT NULL,
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 8. CONTACT FORMS
-- ============================================================

CREATE TABLE contact_form_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_type contact_form_type NOT NULL DEFAULT 'general',

    -- Common fields
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150),
    phone VARCHAR(15) NOT NULL,
    city VARCHAR(100),
    message TEXT,

    -- Aayojan-specific
    event_name VARCHAR(200),
    number_of_people INT,
    preferred_date DATE,

    -- Service-specific
    service_id UUID REFERENCES services(id),
    service_name VARCHAR(200),
    category_id UUID REFERENCES categories(id),
    category_name VARCHAR(100),

    -- Admin handling
    is_read BOOLEAN DEFAULT FALSE,
    admin_notes TEXT,
    assigned_to UUID REFERENCES users(id), -- admin who handles
    status VARCHAR(20) DEFAULT 'new', -- new, in_progress, resolved, closed

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_contact_form_type ON contact_form_entries(form_type);
CREATE INDEX idx_contact_status ON contact_form_entries(status);

-- ============================================================
-- 8b. ANALYTICS & GALLERY
-- ============================================================

CREATE TABLE analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(20) NOT NULL, -- 'service' | 'aayojan_event' | 'blog'
    entity_id UUID NOT NULL,
    event_type VARCHAR(20) NOT NULL DEFAULT 'view',
    user_id UUID REFERENCES users(id),
    visitor_hash VARCHAR(64) NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_analytics_entity ON analytics_events(entity_type, entity_id, created_at);
CREATE INDEX idx_analytics_user ON analytics_events(user_id, created_at) WHERE user_id IS NOT NULL;
CREATE INDEX idx_analytics_visitor ON analytics_events(visitor_hash, created_at);

CREATE TABLE gallery_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    image_url TEXT NOT NULL,
    title VARCHAR(200),
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_gallery_images_active ON gallery_images(is_active, display_order);

-- ============================================================
-- 9. BLOGS
-- ============================================================

CREATE TABLE blog_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(120) NOT NULL UNIQUE,
    description TEXT,
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE blog_authors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(120) NOT NULL UNIQUE,
    bio TEXT,
    avatar_url TEXT,
    user_id UUID REFERENCES users(id), -- link to admin user if applicable
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE blogs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(300) NOT NULL,
    slug VARCHAR(350) NOT NULL UNIQUE,
    category_id UUID REFERENCES blog_categories(id),
    author_id UUID REFERENCES blog_authors(id),

    -- Content
    excerpt TEXT,
    content TEXT NOT NULL, -- HTML from rich text editor
    feature_image_url TEXT,

    -- SEO
    meta_title VARCHAR(200),
    meta_description TEXT,

    -- Flags
    is_featured BOOLEAN DEFAULT FALSE,
    status content_status DEFAULT 'draft',
    published_at TIMESTAMP WITH TIME ZONE,

    -- Stats
    view_count INT DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_blogs_slug ON blogs(slug);
CREATE INDEX idx_blogs_category ON blogs(category_id);
CREATE INDEX idx_blogs_status ON blogs(status);
CREATE INDEX idx_blogs_featured ON blogs(is_featured) WHERE is_featured = TRUE;
CREATE INDEX idx_blogs_published ON blogs(published_at DESC);

-- Blog images (additional gallery)
CREATE TABLE blog_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    blog_id UUID NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    alt_text VARCHAR(200),
    display_order INT DEFAULT 0
);

-- Recommended/related blogs
CREATE TABLE blog_recommended (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    blog_id UUID NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
    recommended_blog_id UUID NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
    display_order INT DEFAULT 0,
    UNIQUE(blog_id, recommended_blog_id),
    CHECK (blog_id != recommended_blog_id)
);

-- ============================================================
-- 10. COUPONS
-- ============================================================

CREATE TABLE coupons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(30) NOT NULL UNIQUE,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    discount_type coupon_discount_type NOT NULL,
    discount_value DECIMAL(10,2) NOT NULL, -- percentage value OR fixed rupee amount
    max_discount_amount DECIMAL(10,2), -- cap for percentage type
    min_order_amount DECIMAL(10,2) DEFAULT 0,
    usage_limit INT, -- NULL = unlimited
    usage_count INT DEFAULT 0,
    per_user_limit INT DEFAULT 1,
    valid_from TIMESTAMP WITH TIME ZONE NOT NULL,
    valid_until TIMESTAMP WITH TIME ZONE NOT NULL,
    applicable_services UUID[], -- NULL = all services
    applicable_categories UUID[], -- NULL = all categories
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_coupons_code ON coupons(code);
CREATE INDEX idx_coupons_valid ON coupons(valid_from, valid_until, is_active);

-- Track per-user coupon usage
CREATE TABLE coupon_usages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    coupon_id UUID NOT NULL REFERENCES coupons(id),
    user_id UUID NOT NULL REFERENCES users(id),
    order_id UUID, -- set after orders table
    used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_coupon_usage ON coupon_usages(coupon_id, user_id);

-- ============================================================
-- 11. ORDERS & CHECKOUT
-- ============================================================

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(30) NOT NULL UNIQUE, -- YAJ2026071901 format
    user_id UUID NOT NULL REFERENCES users(id),
    service_id UUID NOT NULL REFERENCES services(id),
    aayojan_event_id UUID REFERENCES aayojan_events(id), -- if aayojan booking

    -- User info snapshot (at time of order)
    customer_name VARCHAR(100) NOT NULL,
    customer_phone VARCHAR(15) NOT NULL,
    customer_whatsapp VARCHAR(15),
    customer_calling_number VARCHAR(15),
    customer_email VARCHAR(150),

    -- Puja-specific
    gotra VARCHAR(100),
    gotra_unknown BOOLEAN DEFAULT FALSE,

    -- Scheduling
    booking_date DATE NOT NULL,
    booking_time TIME NOT NULL,
    booking_datetime TIMESTAMP WITH TIME ZONE NOT NULL, -- computed: date + time

    -- Address (for at-home services)
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(10),
    latitude DECIMAL(10,7),
    longitude DECIMAL(10,7),

    -- Pricing
    base_price DECIMAL(10,2) NOT NULL,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    addon_total DECIMAL(10,2) NOT NULL DEFAULT 0,
    convenience_fee DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL,
    coupon_id UUID REFERENCES coupons(id),
    coupon_code VARCHAR(30),

    -- Astrology-specific (nullable)
    birth_date DATE,
    birth_time TIME,
    birth_place VARCHAR(150),

    -- Status
    status booking_status NOT NULL DEFAULT 'pending',
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancellation_reason TEXT,
    cancelled_by UUID REFERENCES users(id),
    completed_at TIMESTAMP WITH TIME ZONE,

    -- Notes
    special_instructions TEXT,
    admin_notes TEXT,

    device_source device_source DEFAULT 'web',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_service ON orders(service_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_number ON orders(order_number);
CREATE INDEX idx_orders_date ON orders(booking_date);
CREATE INDEX idx_orders_datetime ON orders(booking_datetime);

-- Puja members (array of names participating)
CREATE TABLE order_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    display_order INT DEFAULT 0
);

CREATE INDEX idx_order_members ON order_members(order_id);

-- Per-order addon snapshots (name/price at time of booking)
CREATE TABLE order_addons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    addon_id UUID REFERENCES addons(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_order_addons_order ON order_addons(order_id);

-- ============================================================
-- 12. PAYMENTS (Razorpay)
-- ============================================================

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id),

    -- Razorpay fields
    razorpay_order_id VARCHAR(100), -- order_xxxx from Razorpay
    razorpay_payment_id VARCHAR(100), -- pay_xxxx
    razorpay_signature VARCHAR(500),

    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(5) DEFAULT 'INR',
    method VARCHAR(30), -- card, upi, netbanking, wallet

    status payment_status NOT NULL DEFAULT 'pending',
    error_code VARCHAR(50),
    error_description TEXT,
    error_reason VARCHAR(100),

    paid_at TIMESTAMP WITH TIME ZONE,
    refunded_at TIMESTAMP WITH TIME ZONE,
    refund_amount DECIMAL(10,2),
    refund_id VARCHAR(100),

    raw_response JSONB, -- full Razorpay webhook payload
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_payments_order ON payments(order_id);
CREATE INDEX idx_payments_razorpay ON payments(razorpay_order_id);
CREATE INDEX idx_payments_status ON payments(status);

-- ============================================================
-- 13. PANDIT ASSIGNMENTS
-- ============================================================

CREATE TABLE pandit_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id),
    pandit_id UUID NOT NULL REFERENCES pandit_profiles(id),
    assigned_by UUID REFERENCES users(id), -- admin who assigned, NULL = auto

    status pandit_assignment_status NOT NULL DEFAULT 'pending',

    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    respond_by TIMESTAMP WITH TIME ZONE NOT NULL, -- 48 hours from assignment
    accepted_at TIMESTAMP WITH TIME ZONE,
    rejected_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    completed_at TIMESTAMP WITH TIME ZONE,

    pandit_notes TEXT, -- notes from pandit
    admin_notes TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_pandit_assign_order ON pandit_assignments(order_id);
CREATE INDEX idx_pandit_assign_pandit ON pandit_assignments(pandit_id);
CREATE INDEX idx_pandit_assign_status ON pandit_assignments(status);
CREATE INDEX idx_pandit_assign_respond ON pandit_assignments(respond_by) WHERE status = 'pending';

-- ============================================================
-- 14. INVOICES
-- ============================================================

CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id),
    invoice_number VARCHAR(30) NOT NULL UNIQUE, -- INV-2026-0001
    pdf_url TEXT, -- S3 URL of generated PDF
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Snapshot of order data at invoice time
    invoice_data JSONB NOT NULL, -- full order + payment + service details

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_invoices_order ON invoices(order_id);
CREATE INDEX idx_invoices_number ON invoices(invoice_number);

-- ============================================================
-- 15. NOTIFICATION CAMPAIGNS (admin broadcast management)
-- ============================================================

CREATE TABLE notification_campaigns (
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

CREATE INDEX idx_notification_campaigns_status_scheduled
  ON notification_campaigns(status, scheduled_at);
CREATE INDEX idx_notification_campaigns_created
  ON notification_campaigns(created_at DESC);
CREATE INDEX idx_notification_campaigns_created_by
  ON notification_campaigns(created_by);

-- ============================================================
-- 15b. NOTIFICATIONS (per-user inbox + campaign recipients)
-- ============================================================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES notification_campaigns(id) ON DELETE SET NULL,
    title VARCHAR(200) NOT NULL,
    body TEXT,
    type VARCHAR(50), -- booking_update, pandit_assigned, payment, review, promo
    reference_id UUID, -- order_id, service_id, etc.
    reference_type VARCHAR(50), -- order, service, blog
    image_url TEXT,
    deep_link TEXT,
    action_type VARCHAR(50),
    action_value TEXT,
    delivery_status notification_delivery_status DEFAULT 'sent',
    failure_reason TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    clicked_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_campaign ON notifications(campaign_id);
CREATE INDEX idx_notifications_user_inbox
  ON notifications(user_id, deleted_at, created_at DESC);

-- ============================================================
-- 16. ACTIVITY LOG (admin audit trail)
-- ============================================================

CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL, -- create_service, update_order, assign_pandit
    entity_type VARCHAR(50) NOT NULL, -- service, order, user, coupon
    entity_id UUID,
    old_data JSONB,
    new_data JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_activity_user ON activity_logs(user_id);
CREATE INDEX idx_activity_entity ON activity_logs(entity_type, entity_id);

-- ============================================================
-- 17. SETTINGS (key-value config)
-- ============================================================

CREATE TABLE app_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) NOT NULL UNIQUE,
    value TEXT NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL DEFAULT 'system',
    value_type VARCHAR(20) NOT NULL DEFAULT 'string',
    is_public BOOLEAN NOT NULL DEFAULT false,
    is_editable BOOLEAN NOT NULL DEFAULT true,
    updated_by UUID REFERENCES users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_app_settings_category ON app_settings(category);
CREATE INDEX idx_app_settings_is_public ON app_settings(is_public);

-- Insert default settings (legacy + catalog)
INSERT INTO app_settings (key, value, description, category, value_type, is_public, is_editable) VALUES
('booking_advance_hours', '24', 'Minimum hours before service for booking', 'booking', 'number', true, true),
('pandit_response_hours', '48', 'Hours pandit has to accept/reject assignment', 'booking', 'number', false, true),
('otp_expiry_minutes', '10', 'OTP code expiry in minutes', 'security', 'number', false, true),
('max_otp_attempts', '5', 'Max OTP verification attempts', 'security', 'number', false, true),
('razorpay_key_id', '', 'Razorpay API key ID', 'system', 'string', false, false),
('razorpay_key_secret', '', 'Razorpay API key secret', 'system', 'string', false, false),
('support_phone', '+918109181057', 'Support phone number', 'support', 'string', true, true),
('support_email', 'contact@yajmanapp.in', 'Support email', 'support', 'string', true, true),
('support_whatsapp', '+918109181057', 'WhatsApp support number', 'support', 'string', true, true),
('invoice_prefix', 'INV', 'Invoice number prefix', 'system', 'string', false, true),
('order_prefix', 'YAJ', 'Order number prefix', 'system', 'string', false, true),
('s3_bucket', 'yajman-uploads', 'S3 bucket name', 'system', 'string', false, false),
('s3_region', 'ap-south-1', 'S3 region', 'system', 'string', false, false),
('max_upload_size_mb', '10', 'Max file upload size in MB', 'media', 'number', true, true),
('android.current_version', '1.0.0', 'Current production Android version label', 'android', 'string', true, true),
('android.latest_version', '1.0.0', 'Latest Android app version on Play Store', 'android', 'string', true, true),
('android.minimum_supported_version', '1.0.0', 'Minimum Android version allowed without force update', 'android', 'string', true, true),
('android.force_update', 'false', 'Force all Android users to update', 'android', 'boolean', true, true),
('android.update_message', 'A new version is available', 'Android update prompt message', 'android', 'string', true, true),
('android.store_url', 'https://play.google.com/store/apps/details?id=in.yajman.app', 'Google Play store URL', 'android', 'string', true, true),
('ios.current_version', '1.0.0', 'Current production iOS version label', 'ios', 'string', true, true),
('ios.latest_version', '1.0.0', 'Latest iOS app version on App Store', 'ios', 'string', true, true),
('ios.minimum_supported_version', '1.0.0', 'Minimum iOS version allowed without force update', 'ios', 'string', true, true),
('ios.force_update', 'false', 'Force all iOS users to update', 'ios', 'boolean', true, true),
('ios.update_message', 'A new version is available', 'iOS update prompt message', 'ios', 'string', true, true),
('ios.store_url', 'https://apps.apple.com/app/id000000000', 'Apple App Store URL', 'ios', 'string', true, true),
('general.app_name', 'Yajman', 'App display name', 'general', 'string', true, true),
('general.app_tagline', 'Book pandits for every occasion', 'App tagline', 'general', 'string', true, true),
('general.website_url', 'https://yajmanapp.in', 'Marketing website URL', 'general', 'string', true, true),
('general.company_address', '', 'Company address', 'general', 'string', true, true),
('general.privacy_policy_url', 'https://yajmanapp.in/privacy', 'Privacy policy URL', 'general', 'string', true, true),
('general.terms_url', 'https://yajmanapp.in/terms', 'Terms & conditions URL', 'general', 'string', true, true),
('general.about_us_url', 'https://yajmanapp.in/about', 'About us URL', 'general', 'string', true, true),
('general.contact_us_url', 'https://yajmanapp.in/contact', 'Contact us URL', 'general', 'string', true, true),
('general.maintenance_message', '', 'Message shown during maintenance mode', 'general', 'string', true, true),
('social.facebook_url', '', 'Facebook page URL', 'social', 'string', true, true),
('social.instagram_url', '', 'Instagram profile URL', 'social', 'string', true, true),
('social.youtube_url', '', 'YouTube channel URL', 'social', 'string', true, true),
('social.twitter_url', '', 'X / Twitter profile URL', 'social', 'string', true, true),
('social.linkedin_url', '', 'LinkedIn page URL', 'social', 'string', true, true),
('support.hours', '9:00 AM - 6:00 PM IST', 'Support availability hours', 'support', 'string', true, true),
('support.telegram_url', '', 'Telegram support link', 'support', 'string', true, true),
('support.live_chat_url', '', 'Live chat URL', 'support', 'string', true, true),
('support.help_center_url', '', 'Help center URL', 'support', 'string', true, true),
('features.booking_enabled', 'true', 'Enable service bookings', 'features', 'boolean', true, true),
('features.maintenance_mode', 'false', 'Show maintenance screen in mobile apps', 'features', 'boolean', true, true),
('features.aayojan_enabled', 'true', 'Enable Aayojan events', 'features', 'boolean', true, true),
('features.reviews_enabled', 'true', 'Enable reviews', 'features', 'boolean', true, true),
('features.coupons_enabled', 'true', 'Enable coupons', 'features', 'boolean', true, true),
('features.chat_enabled', 'false', 'Enable in-app chat', 'features', 'boolean', true, true),
('features.wallet_enabled', 'false', 'Enable wallet', 'features', 'boolean', true, true),
('features.notifications_enabled', 'true', 'Enable notification module in app', 'features', 'boolean', true, true),
('features.referral_enabled', 'false', 'Enable referral system', 'features', 'boolean', true, true),
('features.payments_enabled', 'true', 'Enable online payments', 'features', 'boolean', true, true),
('features.offline_mode_enabled', 'false', 'Enable offline mode', 'features', 'boolean', true, true),
('features.gps_tracking_enabled', 'false', 'Enable GPS tracking', 'features', 'boolean', true, true),
('notifications.push_enabled', 'true', 'Enable push notifications', 'notifications', 'boolean', true, true),
('notifications.email_enabled', 'true', 'Enable email notifications', 'notifications', 'boolean', false, true),
('notifications.sms_enabled', 'true', 'Enable SMS notifications', 'notifications', 'boolean', false, true),
('notifications.promotional_enabled', 'true', 'Allow promotional push campaigns', 'notifications', 'boolean', true, true),
('notifications.system_enabled', 'true', 'Enable system notifications', 'notifications', 'boolean', true, true),
('notifications.order_enabled', 'true', 'Enable order notifications', 'notifications', 'boolean', true, true),
('notifications.marketing_enabled', 'true', 'Enable marketing notifications', 'notifications', 'boolean', true, true),
('media.max_image_count', '5', 'Max images per upload group', 'media', 'number', true, true),
('media.allowed_image_types', 'jpeg,png,webp,gif', 'Allowed image MIME subtypes', 'media', 'string', true, true),
('media.max_video_size_mb', '50', 'Max video upload size in MB', 'media', 'number', true, true),
('media.max_pdf_size_mb', '10', 'Max PDF upload size in MB', 'media', 'number', true, true),
('media.allowed_file_types', 'jpeg,png,webp,gif,pdf', 'Allowed upload file types', 'media', 'string', true, true),
('convenience_fee', '0', 'Checkout convenience fee amount', 'booking', 'number', true, true),
('booking.cancellation_hours', '24', 'Hours before service when free cancel ends', 'booking', 'number', true, true),
('booking.max_members', '10', 'Max members per booking', 'booking', 'number', true, true),
('booking.reschedule_limit', '2', 'Max reschedules per booking', 'booking', 'number', true, true),
('booking.max_future_booking_days', '90', 'How far ahead users can book', 'booking', 'number', true, true),
('booking.timeout_minutes', '30', 'Checkout / booking hold timeout', 'booking', 'number', true, true),
('location.default_city', 'Indore', 'Default city for discovery', 'location', 'string', true, true),
('location.default_lat', '22.7196', 'Default map latitude', 'location', 'number', true, true),
('location.default_lng', '75.8577', 'Default map longitude', 'location', 'number', true, true),
('location.search_radius_km', '50', 'Default search radius in km', 'location', 'number', true, true),
('location.default_country', 'IN', 'Default country code', 'location', 'string', true, true),
('location.default_currency', 'INR', 'Default currency code', 'location', 'string', true, true),
('location.default_timezone', 'Asia/Kolkata', 'Default timezone', 'location', 'string', true, true),
('security.session_timeout_minutes', '43200', 'JWT / session soft timeout hint (minutes)', 'security', 'number', false, true),
('security.max_login_attempts', '5', 'Max login / OTP attempts before lockout hint', 'security', 'number', false, true),
('security.device_token_expiry_days', '365', 'Suggested device token refresh window', 'security', 'number', false, true),
('behaviour.home_refresh_seconds', '60', 'Suggested home refresh interval', 'behaviour', 'number', true, true),
('behaviour.cache_ttl_seconds', '60', 'Suggested client settings cache TTL', 'behaviour', 'number', true, true),
('behaviour.show_intro_screens', 'true', 'Show intro / onboarding screens', 'behaviour', 'boolean', true, true),
('behaviour.enable_app_rating_popup', 'true', 'Enable app rating prompt', 'behaviour', 'boolean', true, true),
('behaviour.enable_force_logout', 'false', 'Force logout all sessions remotely', 'behaviour', 'boolean', true, true),
('behaviour.enable_debug_logs', 'false', 'Enable client debug logs', 'behaviour', 'boolean', false, true),
('behaviour.enable_crash_reporting', 'true', 'Enable crash reporting', 'behaviour', 'boolean', true, true),
('behaviour.enable_analytics', 'true', 'Enable analytics', 'behaviour', 'boolean', true, true),
('behaviour.enable_maintenance_banner', 'false', 'Show maintenance banner', 'behaviour', 'boolean', true, true),
('stats_pujas_completed', '0', 'Home screen completed pujas count', 'system', 'number', true, true),
('stats_connected_pandits', '0', 'Home screen connected pandits count', 'system', 'number', true, true);

-- ============================================================
-- 18. ADD FOREIGN KEY for coupon_usages.order_id
-- ============================================================

ALTER TABLE coupon_usages
    ADD CONSTRAINT fk_coupon_usage_order
    FOREIGN KEY (order_id) REFERENCES orders(id);

-- Add booking_id FK to reviews
ALTER TABLE reviews
    ADD CONSTRAINT fk_review_booking
    FOREIGN KEY (booking_id) REFERENCES orders(id);

-- ============================================================
-- 19. TRIGGERS
-- ============================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_services_updated BEFORE UPDATE ON services FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_blogs_updated BEFORE UPDATE ON blogs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_payments_updated BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_pandit_profiles_updated BEFORE UPDATE ON pandit_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_coupons_updated BEFORE UPDATE ON coupons FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_banners_updated BEFORE UPDATE ON banners FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_notification_campaigns_updated BEFORE UPDATE ON notification_campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_app_settings_updated BEFORE UPDATE ON app_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_puja_processes_updated BEFORE UPDATE ON puja_processes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_puja_process_steps_updated BEFORE UPDATE ON puja_process_steps FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_addons_updated BEFORE UPDATE ON addons FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_recommended_services_updated BEFORE UPDATE ON recommended_services FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-calculate discount_percent on services
CREATE OR REPLACE FUNCTION calc_discount_percent()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.original_price IS NOT NULL AND NEW.original_price > 0 AND NEW.price < NEW.original_price THEN
        NEW.discount_percent = ROUND(((NEW.original_price - NEW.price) / NEW.original_price) * 100);
    ELSE
        NEW.discount_percent = NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_service_discount BEFORE INSERT OR UPDATE OF price, original_price ON services
    FOR EACH ROW EXECUTE FUNCTION calc_discount_percent();

-- Auto-generate order_number: YAJ + YYYYMMDD + 2-digit sequence
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
DECLARE
    date_part TEXT;
    seq_num INT;
BEGIN
    date_part := TO_CHAR(NOW(), 'YYYYMMDD');
    SELECT COALESCE(MAX(CAST(RIGHT(order_number, 2) AS INT)), 0) + 1
    INTO seq_num
    FROM orders
    WHERE order_number LIKE 'YAJ' || date_part || '%';
    NEW.order_number := 'YAJ' || date_part || LPAD(seq_num::TEXT, 2, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_order_number BEFORE INSERT ON orders
    FOR EACH ROW WHEN (NEW.order_number IS NULL)
    EXECUTE FUNCTION generate_order_number();

-- Auto-generate invoice_number: INV-YYYY-NNNN
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
DECLARE
    year_part TEXT;
    seq_num INT;
BEGIN
    year_part := TO_CHAR(NOW(), 'YYYY');
    SELECT COALESCE(MAX(CAST(SPLIT_PART(invoice_number, '-', 3) AS INT)), 0) + 1
    INTO seq_num
    FROM invoices
    WHERE invoice_number LIKE 'INV-' || year_part || '-%';
    NEW.invoice_number := 'INV-' || year_part || '-' || LPAD(seq_num::TEXT, 4, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_invoice_number BEFORE INSERT ON invoices
    FOR EACH ROW WHEN (NEW.invoice_number IS NULL)
    EXECUTE FUNCTION generate_invoice_number();

-- ============================================================
-- DONE. 40+ tables, all indexes, triggers, enums.
-- ============================================================
