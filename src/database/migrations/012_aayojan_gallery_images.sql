-- 012_aayojan_gallery_images.sql
-- Page-level Aayojan image gallery — standalone images (not tied to a specific
-- event or banner), bulk-uploaded multiple at a time. Deliberately no
-- title/link_url (unlike aayojan_banners) — images only.

CREATE TABLE IF NOT EXISTS aayojan_gallery_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    image_url TEXT NOT NULL,
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
