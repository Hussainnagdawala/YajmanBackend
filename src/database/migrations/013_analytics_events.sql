-- 013_analytics_events.sql
-- Phase 2 of admin dashboard analytics: view tracking. Nothing tracked page
-- views before this — services.view_count exists but was never incremented
-- anywhere in the code.
--
-- user_id is populated only when the viewer happens to be logged in (an
-- optional-auth middleware picks up a bearer token if one is sent, but public
-- detail pages don't require one). visitor_hash (sha256 of IP + User-Agent)
-- is what makes anonymous visitors countable at all — a rough per-visitor
-- fingerprint, not a real identity. Both are set on every row so "views by
-- this specific user" and "unique anonymous visitors" are both queryable.

CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(20) NOT NULL, -- 'service' | 'aayojan_event' | 'blog'
    entity_id UUID NOT NULL,
    event_type VARCHAR(20) NOT NULL DEFAULT 'view',
    user_id UUID REFERENCES users(id),
    visitor_hash VARCHAR(64) NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_entity ON analytics_events(entity_type, entity_id, created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_user ON analytics_events(user_id, created_at) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_visitor ON analytics_events(visitor_hash, created_at);
