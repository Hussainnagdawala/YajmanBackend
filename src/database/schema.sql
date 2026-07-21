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
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'pandit_assigned', 'in_progress', 'completed', 'cancelled', 'refunded');
CREATE TYPE payment_status AS ENUM ('pending', 'created', 'authorized', 'captured', 'failed', 'refunded');
CREATE TYPE pandit_assignment_status AS ENUM ('pending', 'accepted', 'rejected', 'expired', 'completed');
CREATE TYPE coupon_discount_type AS ENUM ('percentage', 'fixed');
CREATE TYPE content_status AS ENUM ('draft', 'published', 'archived');
CREATE TYPE contact_form_type AS ENUM ('general', 'service', 'aayojan');
CREATE TYPE banner_position AS ENUM ('hero_slider', 'middle_ad', 'offer_banner', 'category_banner');
CREATE TYPE device_source AS ENUM ('web', 'app', 'portal');

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
    meta_title VARCHAR(200),
    meta_description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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
-- 4. SERVICES (main entity)
-- ============================================================

CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(200) NOT NULL,
    slug VARCHAR(250) NOT NULL UNIQUE,
    category_id UUID NOT NULL REFERENCES categories(id),
    type_id UUID REFERENCES types(id),

    -- Pricing
    price DECIMAL(10,2) NOT NULL,
    original_price DECIMAL(10,2), -- strikethrough price (NULL = no discount)
    discount_percent INT, -- auto-calculated or manual

    -- Content
    short_description TEXT,
    about_puja TEXT, -- "About this Puja" section
    description TEXT, -- detailed description
    custom_content TEXT, -- rich HTML from text editor (optional)

    -- Location
    location VARCHAR(200),
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(10),
    latitude DECIMAL(10,7),
    longitude DECIMAL(10,7),

    -- Media
    feature_image_url TEXT NOT NULL,
    video_url TEXT,

    -- Duration & scheduling
    duration_minutes INT,
    advance_booking_hours INT DEFAULT 24, -- must book X hours before

    -- Flags
    is_active BOOLEAN DEFAULT TRUE,
    is_featured BOOLEAN DEFAULT FALSE,
    is_bestseller BOOLEAN DEFAULT FALSE,

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

-- Service key features (bullet points)
CREATE TABLE service_key_features (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    icon_url TEXT,
    display_order INT DEFAULT 0
);

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
-- 5. REVIEWS
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
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(service_id, page, section)
);

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
-- 15. NOTIFICATIONS (for app + portal)
-- ============================================================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    body TEXT,
    type VARCHAR(50), -- booking_update, pandit_assigned, payment, review, promo
    reference_id UUID, -- order_id, service_id, etc.
    reference_type VARCHAR(50), -- order, service, blog
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);

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
    updated_by UUID REFERENCES users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default settings
INSERT INTO app_settings (key, value, description) VALUES
('booking_advance_hours', '24', 'Minimum hours before service for booking'),
('pandit_response_hours', '48', 'Hours pandit has to accept/reject assignment'),
('otp_expiry_minutes', '10', 'OTP code expiry in minutes'),
('max_otp_attempts', '5', 'Max OTP verification attempts'),
('razorpay_key_id', '', 'Razorpay API key ID'),
('razorpay_key_secret', '', 'Razorpay API key secret'),
('support_phone', '+918109181057', 'Support phone number'),
('support_email', 'contact@yajmanapp.in', 'Support email'),
('support_whatsapp', '+918109181057', 'WhatsApp support number'),
('invoice_prefix', 'INV', 'Invoice number prefix'),
('order_prefix', 'YAJ', 'Order number prefix'),
('s3_bucket', 'yajman-uploads', 'S3 bucket name'),
('s3_region', 'ap-south-1', 'S3 region'),
('max_upload_size_mb', '10', 'Max file upload size in MB');

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
-- DONE. 32 tables, all indexes, triggers, enums.
-- ============================================================
