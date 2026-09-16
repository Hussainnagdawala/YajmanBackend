-- 020_legal_pages.sql
-- Dynamic legal/content pages (Terms & Conditions, Privacy Policy, Cookies
-- Policy, Disclaimer, Return Policy) editable from admin. Fixed catalog —
-- admin can edit title/content/meta/visibility but not add or remove rows,
-- so the website's hardcoded /terms, /privacy, /cookies, /disclaimer,
-- /return-policy routes always have a matching slug to fetch.

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
