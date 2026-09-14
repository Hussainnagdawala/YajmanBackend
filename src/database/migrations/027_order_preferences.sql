-- 027_order_preferences.sql
-- Customer-selected puja preference checkboxes at checkout (e.g. "Experienced
-- Pandit Ji", "Shastriya Vidhi Anusaar", "Receive Full Video"). Fixed set of
-- keys validated at the app layer (checkout.schema.ts) — plain text[] here,
-- no lookup table needed since the options aren't admin-configurable.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS preferences TEXT[] DEFAULT '{}';
