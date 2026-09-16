-- 021_booking_reminder_flags.sql
-- Per-order timestamps so the booking-reminder cron sends each reminder window
-- (T-24h and T-2h before booking_datetime) exactly once.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS reminder_24h_sent_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS reminder_2h_sent_at TIMESTAMP WITH TIME ZONE;
