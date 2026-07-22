-- ============================================================
-- Migration 001: Device tokens for push notifications
-- Run once against an already-provisioned DB (schema.sql + seed.sql
-- already applied). Adds the table needed to actually deliver push
-- notifications to web/Android/iOS — device_source on users/orders
-- and device_info on refresh_tokens are both just session labels,
-- neither stores an FCM/APNs/Web-Push token.
-- ============================================================

CREATE TYPE device_platform AS ENUM ('web', 'android', 'ios');

-- A push token is unique per device install, not per user: the same
-- physical device can log in as a different user (shared device,
-- logout/login), and registration must reassign that token rather
-- than fail or duplicate — hence UNIQUE(token), not UNIQUE(user_id, token).
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
