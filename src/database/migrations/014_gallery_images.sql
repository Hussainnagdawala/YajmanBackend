-- 014_gallery_images.sql
-- Standalone website gallery — same pattern as aayojan_gallery_images
-- (012_aayojan_gallery_images.sql), but with a real PATCH-able is_active
-- toggle (not just one-way soft delete) so admin can reversibly manage
-- visibility, plus an optional title/caption.

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
