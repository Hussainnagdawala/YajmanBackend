-- 025_popular_search_services.sql
-- Lets a popular search chip map directly to an arbitrary curated set of
-- services (e.g. "Health" -> Brahmin Bhoj + Gau Seva) instead of relying on
-- popular_searches.link_url resolving through a title/category/tag match.
-- Both mechanisms coexist: link_url stays as the simple case, this table
-- covers curated groupings that don't share a matchable title/category/tag.

CREATE TABLE IF NOT EXISTS popular_search_services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    popular_search_id UUID NOT NULL REFERENCES popular_searches(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    display_order INT DEFAULT 0,
    UNIQUE(popular_search_id, service_id)
);

CREATE INDEX IF NOT EXISTS idx_popular_search_services_search ON popular_search_services(popular_search_id);
