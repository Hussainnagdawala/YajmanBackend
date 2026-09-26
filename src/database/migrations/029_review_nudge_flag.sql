-- 029_review_nudge_flag.sql
-- One-shot follow-up asking the customer to leave a review ~24h after
-- the booking is marked completed (skips orders that already have a review).

ALTER TABLE orders ADD COLUMN IF NOT EXISTS review_nudge_sent_at TIMESTAMP WITH TIME ZONE;
