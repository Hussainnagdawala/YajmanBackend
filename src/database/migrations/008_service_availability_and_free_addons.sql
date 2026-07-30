-- 008_service_availability_and_free_addons.sql
-- Drop location/city/state from services (unused going forward; pincode/
-- latitude/longitude kept). Rename advance_booking_hours -> advance_booking_days
-- (this column was never actually enforced anywhere — see booking.service.ts
-- change in the same feature — so reinterpreting its unit is safe). Add a
-- booking-availability model (period + all-day/specific-day + explicit date
-- list) and a free-addon flag.

ALTER TABLE services DROP COLUMN IF EXISTS location;
ALTER TABLE services DROP COLUMN IF EXISTS city;
ALTER TABLE services DROP COLUMN IF EXISTS state;

ALTER TABLE services RENAME COLUMN advance_booking_hours TO advance_booking_days;
ALTER TABLE services ALTER COLUMN advance_booking_days SET DEFAULT 0;

ALTER TABLE services ADD COLUMN IF NOT EXISTS availability_start_date DATE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS availability_end_date DATE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS booking_availability_type VARCHAR(20) NOT NULL DEFAULT 'all_day'
  CHECK (booking_availability_type IN ('all_day', 'specific_day'));
-- ISO date strings, not DATE[] — avoids the array-of-date timezone-parsing
-- issue the scalar DATE_OID override in config/database.ts doesn't cover.
ALTER TABLE services ADD COLUMN IF NOT EXISTS available_dates TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE addons ADD COLUMN IF NOT EXISTS is_free BOOLEAN NOT NULL DEFAULT false;
