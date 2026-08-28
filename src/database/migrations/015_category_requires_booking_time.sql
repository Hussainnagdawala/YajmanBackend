-- Time slot selection is only shown/required for categories that need a specific
-- booking time (currently only "PanditJi At Home"). All other categories book
-- by date only and receive a default time server-side.

ALTER TABLE categories ADD COLUMN IF NOT EXISTS requires_booking_time BOOLEAN NOT NULL DEFAULT false;

UPDATE categories
SET requires_booking_time = true
WHERE slug = 'panditji-at-home';
