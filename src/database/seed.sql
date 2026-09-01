-- ============================================================
-- YAJMAN — Seed Data
-- Run AFTER schema.sql
-- ============================================================

-- Admin user (change phone to your admin number)
INSERT INTO users (phone, country_code, name, email, role, status) VALUES
('8109181057', '+91', 'Yajman Admin', 'admin@yajmanapp.in', 'admin', 'active');

-- ─── CATEGORIES ─────────────────────────────────────────────
INSERT INTO categories (name, slug, description, display_order, requires_booking_time) VALUES
('Puja At Home', 'puja-at-home', 'Book experienced pandits for pujas at your home', 1, false),
('E-Puja', 'e-puja', 'Live-streamed pujas performed at sacred temples', 2, false),
('Premium Puja', 'premium-puja', 'Premium puja packages with complete arrangements', 3, false),
('Astrology', 'astrology', 'Consult expert astrologers for guidance', 4, false),
('Aarti & Katha', 'aarti-katha', 'Sacred aartis, kathas, bhajans and muhurat guidance', 5, false),
('PanditJi At Home', 'panditji-at-home', 'Book a pandit for rituals and ceremonies at home', 6, true);

-- ─── TYPES ──────────────────────────────────────────────────
INSERT INTO types (name, slug, description, display_order) VALUES
('Health', 'health', 'Health and wellness related pujas', 1),
('Marriage', 'marriage', 'Marriage ceremonies and related rituals', 2),
('Business', 'business', 'Business prosperity and success pujas', 3),
('Navgrah', 'navgrah', 'Navgrah shanti and planetary remedies', 4),
('Festival', 'festival', 'Festival-specific pujas and celebrations', 5);

-- Link types to categories (all categories can have all types)
INSERT INTO category_types (category_id, type_id)
SELECT c.id, t.id FROM categories c CROSS JOIN types t;

-- ─── TAGS ───────────────────────────────────────────────────
INSERT INTO tags (name, slug, color, bg_color, display_order) VALUES
('Featured', 'featured', '#ffffff', '#fb6000', 1),
('Best Seller', 'best-seller', '#ffffff', '#10b981', 2),
('Upcoming', 'upcoming', '#ffffff', '#4d40ca', 3),
('New', 'new', '#ffffff', '#e32682', 4),
('Debt Relief', 'debt-relief', '#ffffff', '#f4a329', 5),
('Special Offer', 'special-offer', '#ffffff', '#d30b0b', 6);

-- ─── POPULAR SEARCHES ───────────────────────────────────────
INSERT INTO popular_searches (label, slug, link_url, display_order, row_number) VALUES
('Panditji at Home', 'panditji-at-home', '/services?category=panditji-at-home', 1, 1),
('Brahmin Bhoj', 'brahmin-bhoj', '/services?search=brahmin+bhoj', 2, 1),
('Puja at Pilgrimage', 'puja-at-pilgrimage', '/services?search=pilgrimage', 3, 1),
('Bhajan Sandhya', 'bhajan-sandhya', '/services?search=bhajan+sandhya', 4, 1),
('Tithi', 'tithi', '/articles?category=muhurat', 1, 2),
('Katha', 'katha', '/articles?category=katha', 2, 2),
('Aarti', 'aarti', '/articles?category=aarti', 3, 2),
('Panchang', 'panchang', '/articles?category=muhurat', 4, 2),
('Choghadiya', 'choghadiya', '/articles?category=muhurat', 5, 2),
('Festival', 'festival', '/services?type=festival', 6, 2),
('Bhajan Lyrics', 'bhajan-lyrics', '/articles?category=bhajan', 7, 2);

-- ─── TESTIMONIALS ───────────────────────────────────────────
INSERT INTO testimonials (author_name, author_designation, quote, rating, page, display_order) VALUES
('Michael Lewis', 'Product Designer', 'This service has taken my business to a whole new level. The design and functionality are both outstanding and user friendly. The team consistently provided timely support and exceeded my expectations.', 5, 'home', 1),
('Priya Sharma', 'Business Owner', 'Yajman made our family puja so convenient. The pandit was knowledgeable and the entire process was smooth from booking to completion.', 5, 'home', 2),
('Rahul Mehta', 'Software Engineer', 'E-Puja service was amazing. We could participate live from abroad and feel connected to the divine rituals happening at the temple.', 5, 'home', 3);

-- ─── BLOG CATEGORIES ────────────────────────────────────────
INSERT INTO blog_categories (name, slug, display_order) VALUES
('Darshan', 'darshan', 1),
('Festivals', 'festivals', 2),
('Spiritual', 'spiritual', 3),
('Rituals', 'rituals', 4);

-- ─── BLOG AUTHORS ───────────────────────────────────────────
INSERT INTO blog_authors (name, slug, bio) VALUES
('Yajman', 'yajman', 'Official Yajman content team');

-- ─── AAYOJAN PAGE CONTENT ───────────────────────────────────
INSERT INTO aayojan_page_content (section_key, title, subtitle, description, display_order) VALUES
('hero', 'Planning a Devotional Event?', 'Let us help you organize', 'Let us help you organize a memorable spiritual gathering with experienced pandits, devotional artists, and complete event management.', 1),
('features', 'Why Choose Yajman Aayojan', 'Complete event management', 'From Sundarkand to Bhajan Sandhya, we handle everything.', 2),
('cta', 'Ready to Plan Your Event?', 'Contact us today', 'Get in touch with our event planning team for a customized devotional event.', 3);

-- ============================================================
-- DONE. Seed data loaded.
-- ============================================================
