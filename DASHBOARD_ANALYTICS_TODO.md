# Dashboard Analytics — Deferred Work (Phase 3)

Reference doc for what's deliberately **not** built yet in the admin dashboard/analytics
work, why, and exactly what to do when it's actually needed. Phases 1 and 2 (KPIs,
trends, leaderboards, view tracking, per-user visit history) are done and live —
see `src/routes/admin/dashboard.routes.ts` and `src/routes/admin/user.routes.ts`
(`GET /admin/users/:id/views`) for the full built surface.

## What's deferred: daily rollup table + cron

Every dashboard/trend endpoint today aggregates live from raw tables (`orders`,
`payments`, `analytics_events`, `users`) on every request — e.g.
`GET /admin/dashboard/trends?metric=revenue` runs `SUM(amount) ... GROUP BY
DATE_TRUNC(...)` over the full `payments` table every single call. That's fine
at current scale (tens of rows) — every endpoint was tested live and returned
in milliseconds. It stops being fine once those tables hit real production
volume (tens/hundreds of thousands+ rows), because query cost grows with
**total history**, not just the requested date range — old data never stops
being scanned.

**Not building it now because**: it adds a maintenance burden (a cron that
must stay correct, a rollup table that can silently drift out of sync with
raw data) for a problem that doesn't exist yet. Cheap to add later without
touching anything else — the fix is additive (new table + cron + swap what
the trend queries read from), not a rewrite.

## Signal: when to actually do this

Don't do it preemptively. Do it when you observe **any** of:
- `GET /admin/dashboard` or `/trends` taking >1-2s to respond in production
- `orders` or `analytics_events` crossing roughly 100k+ rows
- Admin panel visibly lagging when the dashboard loads

## Implementation plan (when the signal above hits)

1. **New table** `daily_stats` — one row per `(stat_date, metric)`:
   ```sql
   CREATE TABLE daily_stats (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     stat_date DATE NOT NULL,
     metric VARCHAR(30) NOT NULL,        -- 'orders' | 'revenue' | 'new_users' | 'service_views'
     entity_id UUID,                     -- NULL for site-wide, set for per-service rollups
     value NUMERIC NOT NULL DEFAULT 0,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     UNIQUE (stat_date, metric, entity_id)
   );
   CREATE INDEX idx_daily_stats_lookup ON daily_stats(metric, stat_date, entity_id);
   ```
2. **New cron** `jobs/daily-stats-rollup.cron.ts` — runs once daily (just after
   midnight), computes **yesterday's** totals from the raw tables (same
   aggregation logic already in `src/queries/dashboard.queries.ts` /
   `src/queries/analytics.queries.ts`, just scoped to one day) and
   upserts into `daily_stats`. Same pattern as `jobs/order-expiry.cron.ts` —
   `node-cron`, wrapped in try/catch, logs failures, never throws.
3. **Backfill script** (one-off, run once when this ships) — same
   per-day aggregation, looped over all historical dates, so `daily_stats`
   isn't empty for existing history on day one.
4. **Swap the trend queries** in `dashboard.controller.ts`'s `getTrends` (and
   any other endpoint doing date-range aggregation, e.g. `getTopServices`) to
   read `SUM(value) FROM daily_stats WHERE metric = $1 AND stat_date BETWEEN
   $2 AND $3 GROUP BY stat_date` instead of the raw tables. Query cost becomes
   bounded by the requested date range, not total history.
5. **Today is still live** — `daily_stats` only has *yesterday and earlier*
   filled in by the cron. "Today" values (e.g. `orders_today` on the main
   dashboard) should keep querying the raw tables directly for the
   still-in-progress day, same as now.
6. Verify: pick a few dates, compare `daily_stats` totals against a live
   raw-table aggregation for the same range — must match exactly before
   trusting the rollup in production.

## What does NOT need this

Leaderboards/detail views that are inherently "all current state," not a time
series — `GET /admin/dashboard/categories`, `GET /admin/dashboard/pandits/performance`,
`GET /admin/dashboard/services/:id/stats` — don't benefit from a daily rollup
the same way; if these get slow instead, the fix is proper indexing on the
raw tables, not this rollup pattern.
