-- ============================================================
-- Migration 002: Notification campaigns + inbox extensions
-- Run once against an already-provisioned DB. Adds admin
-- campaign management and delivery/read/click tracking on the
-- existing per-user notifications inbox.
-- ============================================================

CREATE TYPE notification_target_type AS ENUM ('all', 'selected', 'group', 'topic');
CREATE TYPE notification_campaign_status AS ENUM (
  'draft', 'scheduled', 'sending', 'sent', 'cancelled', 'failed'
);
CREATE TYPE notification_delivery_status AS ENUM (
  'pending', 'sent', 'delivered', 'failed', 'skipped'
);

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

CREATE TRIGGER trg_notification_campaigns_updated
  BEFORE UPDATE ON notification_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES notification_campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS deep_link TEXT,
  ADD COLUMN IF NOT EXISTS action_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS action_value TEXT,
  ADD COLUMN IF NOT EXISTS delivery_status notification_delivery_status DEFAULT 'sent',
  ADD COLUMN IF NOT EXISTS failure_reason TEXT,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_notifications_campaign ON notifications(campaign_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_inbox
  ON notifications(user_id, deleted_at, created_at DESC);
