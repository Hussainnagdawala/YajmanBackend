-- 010_order_payment_failure_states.sql
-- Payment/refund failures and disputes currently have nowhere to go: a
-- pending order that fails payment, or a captured order whose refund call
-- throws, is left with no terminal status distinct from "still in progress".
-- These three values close that gap. Each ADD VALUE is its own autocommitted
-- statement (no BEGIN wrapping in this file, don't run with `psql -1`), and
-- this file is purely additive — no backfill/UPDATE using these values here,
-- since Postgres won't let a new enum value be used in the same transaction
-- that added it.

ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'payment_failed';
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'refund_failed';
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'disputed';
