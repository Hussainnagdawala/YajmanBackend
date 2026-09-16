-- 009_category_capability_flags.sql
-- Some categories don't need a pandit assigned (remote/online pujas) and some
-- have no monetary terms at all (e.g. Katha) — no checkout/payment for them.
-- Both default to true so every existing category/service keeps working
-- exactly as today; this is purely additive/opt-out.

ALTER TABLE categories ADD COLUMN IF NOT EXISTS requires_pandit BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS requires_payment BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE services ALTER COLUMN price DROP NOT NULL;
