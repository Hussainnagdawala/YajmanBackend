-- 023_pandit_daily_capacity.sql
-- Date-only bookings (categories with requires_booking_time = false) never had a
-- real customer-chosen time — the code used to fake one ("09:00") purely so the
-- double-booking check had something to compare. That both misled the UI (looked
-- like a real appointment time) and meant a pandit could only ever hold ONE such
-- booking per day, even though these pujas don't actually clash. This migration
-- lets booking_time be genuinely absent, and pairs it with a per-pandit daily
-- capacity that replaces the exact-time collision check for those bookings —
-- see pandit-availability.service.ts.

ALTER TABLE orders ALTER COLUMN booking_time DROP NOT NULL;
ALTER TABLE pandit_profiles ADD COLUMN IF NOT EXISTS daily_booking_limit INT NOT NULL DEFAULT 3;
