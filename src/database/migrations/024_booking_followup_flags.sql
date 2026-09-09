-- 024_booking_followup_flags.sql
-- Three follow-up signals nobody previously generated:
--  1. A pending pandit assignment nearing its 48h response window — the pandit
--     gets a nudge before it silently expires.
--  2. A confirmed order approaching its booking date with no pandit ever
--     assigned — admin gets a heads-up while there's still time to act.
--  3. A booking whose date has passed with the order still not resolved
--     (never completed, never cancelled/refunded) — admin gets an overdue
--     alert instead of it sitting invisible forever.
-- Flags below make each fire exactly once, same pattern as
-- reminder_24h_sent_at / reminder_2h_sent_at (021_booking_reminder_flags.sql).

ALTER TABLE pandit_assignments ADD COLUMN IF NOT EXISTS expiry_nudge_sent_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS unassigned_alert_sent_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS overdue_alert_sent_at TIMESTAMP WITH TIME ZONE;
