# Yajman Backend

Node.js + Express + TypeScript + PostgreSQL backend for Yajman (website, admin portal, mobile app, pandit portal — one API, four clients).

Source plan docs: [`plan/CLAUDE-CODE-BACKEND-INSTRUCTIONS.md`](../plan/CLAUDE-CODE-BACKEND-INSTRUCTIONS.md), [`plan/api-reference.md`](../plan/api-reference.md), [`plan/backend-implementation-plan.md`](../plan/backend-implementation-plan.md), [`plan/database-schema.sql`](../plan/database-schema.sql).

---

## Stack

- Node.js 20+ / TypeScript / Express 4
- PostgreSQL 16 with `pg` (raw parameterized SQL, no ORM)
- JWT auth (`jsonwebtoken`) + opaque refresh tokens (rotated on use)
- Razorpay payment gateway
- Multer + multer-s3 → AWS S3 file uploads
- Zod validation
- Winston logging, node-cron scheduled jobs

---

## Local PostgreSQL (global install, not project-scoped)

Postgres is **not** bundled inside this repo — it's installed once, globally, for use by any project on this machine.

| | |
|---|---|
| Binaries | `E:\PostgreSQL\pgsql` |
| Data directory | `E:\PostgreSQL\data` |
| Port | `5432` (standard) |
| Superuser | `postgres`, trust auth (no password — localhost dev only) |
| Log file | `E:\PostgreSQL\pglog.log` |

**Auto-starts at Windows login** via a hidden launcher script:
`E:\PostgreSQL\start-postgres-hidden.vbs` → copied into
`%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\`.
(Task Scheduler wasn't available in this environment — `Register-ScheduledTask` and `schtasks` both returned "Access is denied" — so the Startup-folder script is the auto-start mechanism instead. Same effect: Postgres comes up silently on every login.)

**Manual control** (only needed if it's not already running):
```bat
:: start
E:\PostgreSQL\start-postgres.bat

:: stop
E:\PostgreSQL\pgsql\bin\pg_ctl.exe -D "E:\PostgreSQL\data" stop
```

**Connect / inspect:**
```bash
E:\PostgreSQL\pgsql\bin\psql.exe -U postgres -h localhost -p 5432 -d yajman
```

**Databases:** `yajman` — schema + seed already applied (see [Database setup](#database-setup)).

---

## Environment variables

Copy `.env.example` → `.env` and fill in real values before running. Current local dev `.env` already points at the DB above:

```env
DATABASE_URL=postgresql://postgres@localhost:5432/yajman
JWT_SECRET=dev-secret-key-for-local-testing   # replace for anything beyond local dev
JWT_ACCESS_EXPIRY=24h
JWT_REFRESH_EXPIRY=30d
```

Razorpay / AWS S3 vars are currently **dummy placeholders** (`rzp_test_dummy`, `dummy`, etc.) — payments and file uploads will fail until real credentials are filled in. Everything else (auth, profile, admin users) works against the real local DB without them.

Full variable list and meaning: see `.env.example` in this folder (mirrors `plan/backend-implementation-plan.md` § Environment Variables).

---

## Running

```bash
npm install       # first time only
npm run dev        # nodemon + ts-node, watches src/
npm run build       # tsc -> dist/
npm start           # node dist/server.js (after build)
```

Server listens on `PORT` (set in `.env`, currently `5000`). Health check: `GET /health`.
All API routes are mounted under `/api/{API_VERSION}` (default `/api/v1`).

---

## Database setup (fresh machine / fresh DB)

```bash
PGBIN="E:\PostgreSQL\pgsql\bin"
"$PGBIN/createdb.exe" -U postgres -h localhost -p 5432 yajman
"$PGBIN/psql.exe" -U postgres -h localhost -p 5432 -d yajman -f src/database/schema.sql
"$PGBIN/psql.exe" -U postgres -h localhost -p 5432 -d yajman -f src/database/seed.sql
"$PGBIN/psql.exe" -U postgres -h localhost -p 5432 -d yajman -f src/database/migrations/001_add_device_tokens.sql
```

Seed creates: 1 admin user (phone `8109181057`, role `admin`), default categories/types/tags/popular-searches, app settings.

> `src/database/seed.sql` differs from `plan/seed.sql` in one line: the admin phone was fixed from `+918109181057` (country code embedded in the phone field) to plain `8109181057`, matching the `phone` (10-digit) / `country_code` (separate column) convention used everywhere else in the schema and API. Without this fix the seeded admin can't log in through `/auth/send-otp` (fails the 10-digit phone validation).

---

## Build status

Following `plan/CLAUDE-CODE-BACKEND-INSTRUCTIONS.md` § Build Order.

| Step | Status |
|---|---|
| 1. Scaffold | ✅ done |
| 2. Config + Middleware | ✅ done |
| 3. Auth + Users | ✅ done, tested end-to-end against real DB |
| 4. Categories + Types + Tags | ✅ done, tested end-to-end against real DB |
| 5. Services | ✅ done, tested end-to-end against real DB (file-upload paths untested, see gaps) |
| 6. Home page data | ✅ done, tested end-to-end against real DB |
| 7. Blogs | ✅ done, tested end-to-end against real DB |
| 8. Aayojan | ✅ done, tested end-to-end against real DB |
| 9. Coupons | ✅ done, tested end-to-end against real DB |
| 10. Checkout + Payments | ✅ done, tested end-to-end against real DB (Razorpay order-creation call itself untestable, see gaps) |
| 11. Bookings + Reviews | ✅ done, tested end-to-end against real DB (invoice PDF→S3 upload untestable, see gaps) |
| 12. Pandit flow | ✅ done, tested end-to-end against real DB |
| 13. Contact forms + Admin dashboard | ✅ done, tested end-to-end against real DB |
| 14. Cron jobs + polish | ⏳ next |

### What's implemented (Steps 1–3)

- **Config:** `env.ts` (Zod-validated), `database.ts` (pg Pool), `logger.ts` (Winston), `s3.ts`, `razorpay.ts`
- **Middleware:** `auth.ts` (JWT + req.user), `role.ts` (`requireRole`), `validate.ts` (Zod), `upload.ts` (multer-s3), `errorHandler.ts`, `rateLimiter.ts` (global + OTP-specific), `requestLogger.ts` (Morgan → Winston)
- **Utils:** `response.ts`, `errors.ts` (`AppError`), `pagination.ts`, `phone.ts`, `date.ts`, `crypto.ts`
- **Auth flow:** `POST /auth/send-otp`, `POST /auth/verify-otp`, `POST /auth/refresh-token`, `POST /auth/logout`, `GET /auth/me`
- **Profile:** `GET /profile`, `PATCH /profile`, `POST /profile/avatar`
- **Admin users:** `POST /admin/users`, `GET /admin/users` (filter by role/status/search + pagination), `GET/PATCH /admin/users/:id`, `PATCH /admin/users/:id/status`
- **Categories:** `GET /categories` (public, active only, includes linked types + type_count), `GET/POST /admin/categories`, `GET/PATCH/DELETE /admin/categories/:id` (delete = soft, blocked with 409 if services are linked)
- **Types:** `GET /types` (public), `GET/POST /admin/types`, `PATCH/DELETE /admin/types/:id`
- **Tags:** `GET /tags` (public), `GET/POST /admin/tags`, `PATCH/DELETE /admin/tags/:id`
- **Slugs:** `services/slug.service.ts` — auto-generates unique slugs (name → slug, `-2`/`-3`… suffix on collision) for categories/types/tags/blogs/services/temples
- **Services:** `GET /services` (public, filter by category/type/tag/search/price range/rating/city/featured/bestseller, sort, pagination), `GET /services/:slug` (full detail: images, types, tags, temples, key features, packages, FAQs), `GET /services/bestsellers` (grouped by category), `POST/PATCH /admin/services` (multipart, transactional — service row + type/tag/temple junctions + nested key_features/packages/faqs all committed or rolled back together), `DELETE /admin/services/:id` (soft delete), `POST /admin/services/:id/images` + `DELETE /admin/services/:id/images/:imageId` (gallery management, S3 cleanup on delete). `custom_content` HTML is sanitized with DOMPurify before storage.
- **Temples:** `GET/POST/PATCH/DELETE /admin/temples` — simple CRUD, linked to services via `service_temples`
- **Home:** `GET /home` (public aggregator — hero banners, popular searches, testimonials, bestsellers grouped by category, categories, offer banner, recent blogs, stats), plus admin CRUD for `/admin/banners`, `/admin/popular-searches`, `/admin/testimonials`, `/admin/recommended-services`
- **Aayojan (event planning):** `GET /aayojan` (public aggregator — page content sections, published events, banners, testimonials for page=aayojan), `GET /aayojan/events/:slug` (public event detail — not in the spec's endpoint list, added for the same reason as `GET /admin/blogs`: without it "events" is a list nobody can click into), `POST /aayojan/contact` (public form, stored in the shared `contact_form_entries` table with `form_type='aayojan'`), plus admin CRUD for `/admin/aayojan/content` (section-keyed CMS blocks), `/admin/aayojan/events` (with gallery images), `/admin/aayojan/banners`.
- **Bookings + Reviews + Invoices:** `GET /bookings` (tabs: upcoming/completed/cancelled), `GET /bookings/:id` (full detail — service snapshot, members, pandit info if assigned, latest payment, own review, all null-safe when absent), `PATCH /bookings/:id/cancel` (24h rule, blocks completed/cancelled/refunded, frees any pandit assignment, auto-refunds via Razorpay if payment was captured — refund failure is logged and swallowed rather than blocking the cancellation, since a gateway hiccup shouldn't trap a customer in an uncancellable booking), `POST /bookings/:id/review` and `POST /services/:id/reviews` (two entry points into the same `submitReviewForBooking` logic — booking-completed check, one-review-per-booking, photo upload, triggers `stats.service.ts` to recalculate the service's `rating_avg`/`total_reviews`), `GET /services/:id/reviews` (public, approved-only), `PATCH/DELETE /admin/reviews/:id` (moderation, also recalculates rating), `GET /bookings/:id/invoice` (generates a PDF via PDFKit on first request and caches the S3 URL in `invoices`, returns the cached one on subsequent requests) + `GET /admin/invoices` (date-range filter).
- **Contact forms + Admin dashboard/orders:** `POST /contact` (general, public), `POST /services/:id/inquiry` (service-specific, public, snapshots the service title at submission time), `POST /aayojan/contact` (built in Step 8) — all three write into the shared `contact_form_entries` table with a different `form_type`. `GET/PATCH /admin/contact-entries` (filter by form_type/status, moderate is_read/status/notes/assignment). `GET /admin/dashboard` (total/today orders & revenue — revenue is summed from *captured payments*, not raw order totals, so unpaid/failed orders don't inflate it; active_pandits = `role='pandit' AND status='active'` user accounts, not the `is_available` toggle — a judgment call on an ambiguous metric name). `GET/PATCH /admin/orders` (list with status/date-range/search filters, full detail joining payment/pandit-assignment/invoice/review, direct status+notes override distinct from the customer-facing cancel flow — this one has no refund side effects, it's a blunt admin escape hatch).
- **Pandit flow:** `GET/PATCH /pandit/profile` (auto-provisions the `pandit_profiles` row on first access — there's no separate create-profile endpoint, since the spec only lists GET/PATCH), `GET /pandit/dashboard` (pending count, today/upcoming bookings, rating/completed stats), `GET /pandit/assignments[/:id]`, `PATCH /pandit/assignments/:id/accept|reject` (48h window enforced, double-booking checked against other *accepted* assignments), `GET /pandit/bookings?date=`, `PATCH /pandit/bookings/:id/complete` (pandit or admin — recalculates whichever pandit was actually assigned, not just the caller). Admin side: `POST /admin/pandit-assignments` (checks order isn't cancelled/completed, checks double-booking), `GET /admin/pandit-assignments` (`?expiring=true` = pending with `respond_by` within 12h — a threshold the spec doesn't pin down, chosen here), `PATCH /admin/pandit-assignments/:id/reassign` (re-purposes the same assignment row for a new pandit rather than creating a new one — a PATCH-semantics reading of an ambiguous spec line, documented as a judgment call). `services/notification.service.ts` now actually writes in-app notification rows (pandit assigned, customer/admin notified on accept/reject, customer notified on completion) — see gaps for what it still doesn't do (push/WhatsApp delivery).
- **Checkout + Payments (Razorpay):** `POST /checkout/create-order` (auth required — validates service is active, booking is ≥24h out and not in the past, no duplicate pending booking for the same user/service/date, re-validates any coupon via `coupon.service.ts`, computes `total = price - discount + convenience_fee`, inserts the order + `order_members` transactionally with a retry-on-collision order-number generator, then creates the Razorpay order and a `payments` row), `POST /checkout/verify-payment` (auth required — verifies the HMAC-SHA256 signature with a constant-time comparison, marks the payment captured, confirms the order, and now actually records coupon usage — the gap flagged at the end of Step 9), `POST /checkout/webhook` (no auth, Razorpay calls it directly — verifies webhook signature against the raw request body, handles `payment.captured`/`payment.failed`/`refund.created`, idempotent). Order/payment business logic lives in `services/booking.service.ts` and `services/razorpay.service.ts`.
- **Coupons:** `POST/GET/PATCH/DELETE /admin/coupons` (percentage or fixed, service/category restriction via `applicable_services`/`applicable_categories` UUID arrays, usage limits), `POST /coupons/validate` (auth required, any role — dry-run check: date range, usage limit, per-user limit, min order amount, service/category applicability, active status; returns `{valid, discount_amount, final_amount, coupon}` on success or `{valid: false, message}` on failure — deliberately a 200 either way, not a 4xx, since this is a preview check the frontend needs to render inline, not an error state). Business logic lives in `services/coupon.service.ts` so Step 10 (checkout) can call `validateCoupon()` directly when actually creating an order, rather than going through HTTP.
- **Device tokens (push notifications):** `POST/GET/DELETE /profile/device-tokens` — registers/lists/removes a device's push token (FCM/APNs token or Web Push subscription string) so notifications (Step 12) have somewhere to actually deliver to. Neither `users.device_source` nor `refresh_tokens.device_info` (both pre-existing) store this — they're session/login labels, not push tokens. Added `device_tokens` table via `src/database/migrations/001_add_device_tokens.sql` (not in the original schema/plan — apply it manually against any DB provisioned before this was added: `psql -f src/database/migrations/001_add_device_tokens.sql`). One token can only belong to one user at a time — re-registering an existing token under a different user reassigns it (covers shared-device logout/login), rather than erroring or duplicating.
- **Blogs:** `GET /blogs` (public, filter by category/featured, pagination), `GET /blogs/:slug` (full detail — author, category, gallery images, related blogs, sidebar services), `POST/GET/PATCH/DELETE /admin/blogs` (multipart, transactional — blog row + `blog_recommended` junction + gallery images all committed or rolled back together; delete = soft via `status = 'archived'`), `POST/GET/PATCH/DELETE /admin/blog-categories`, `POST/GET/PATCH/DELETE /admin/blog-authors`. `content` HTML sanitized with DOMPurify. `GET /admin/blogs` isn't in the spec's endpoint list but was added anyway — without it there's no way to discover a draft blog's id to `PATCH`/`DELETE` it.

All routes wired per the registration pattern in `CLAUDE-CODE-BACKEND-INSTRUCTIONS.md` (`/auth` public, `/profile` behind `authenticate`, `/admin` behind `authenticate + requireRole("admin")`).

### Bugs found and fixed during build/testing

1. **OTP storage:** `otp_verifications.otp_code` is `VARCHAR(6)` in schema (plaintext by design) — initial implementation stored a bcrypt hash (60 chars), which failed the column constraint. Switched to plaintext comparison; the 6-digit space is protected by attempt-limits, not hashing.
2. **Admin list-users query:** `countUsers` referenced `$3` with no `$1`/`$2` in its own statement text (shared placeholder numbering with the paginated list query) → Postgres couldn't infer parameter types (`42P18`). Filter-value numbering is now independent of the `LIMIT`/`OFFSET` params.
3. **`date_of_birth` off-by-one-day:** `pg` parses `DATE` columns into a JS `Date` at UTC midnight; serializing to JSON in IST (+5:30) rolled it back a day. Fixed at the driver level (`types.setTypeParser` for the DATE OID in `config/database.ts`), so it's corrected for every current and future DATE column, not just this one.
4. **Seed data phone format:** see [Database setup](#database-setup) above.
5. **ts-node + ambient types:** `types/express.d.ts` (the `req.user` augmentation) was silently skipped by ts-node's lazy per-file compilation, causing a real type error the moment auth-guarded routes were wired in. Fixed via `"ts-node": { "files": true }` in `tsconfig.json`.
6. **Postgres constraint violations → raw 500s:** any unique/foreign-key/type violation (e.g. duplicate category name) fell through to a generic 500 instead of a proper 4xx. Fixed centrally in `middleware/errorHandler.ts` — maps common Postgres error codes (`23505` unique violation, `23503` FK violation, `22P02` invalid input syntax, `22001` value too long) to 409/400 responses, app-wide, not just for categories.
7. **Single-category fetch missing the types join:** `GET /admin/categories/:id` returned bare category columns while the list endpoints included the joined `types`/`type_count`. Made `findCategoryById` consistent with the list queries.
8. **`updateServiceSchema = createServiceSchema.partial()` would have silently reset fields on every partial PATCH.** Zod's `.partial()` only makes keys optional — it does not strip `.default(...)` on the inner schema, so a PATCH sending only `{ price: 999 }` would still parse `advance_booking_hours`, `is_featured`, `is_bestseller`, `display_order`, and every junction/nested-array field (`type_ids`, `tag_ids`, `temple_ids`, `key_features`, `packages`, `faqs`) back to their create-time defaults, wiping them on every update. Caught before shipping — `updateServiceSchema` is now a fully independent schema with no defaults, so omitted fields stay untouched and `[]` is the only way to explicitly clear a junction/array. Verified live: `PATCH` with only `price` left `is_featured`, `is_bestseller`, `advance_booking_hours`, tags, and key_features all untouched; `PATCH` with `faqs=[]` cleared only the FAQs.
9. **Same `.partial()` + `.default()` bug, found retroactively in already-shipped code.** While building Step 6 and re-deriving the pattern, audited every validator for `createXSchema.partial()` reuse and found it already live in three places from Steps 3–4: `updateUserSchema` (admin user PATCH would silently reset `role` back to `"pandit"` on any update omitting it — a privilege-corruption risk), `updateCategorySchema` (PATCH would reset `display_order` to `0` **and always clear the `category_types` junction**, since `type_ids` defaulted to `[]` and the controller's `Array.isArray(type_ids)` check was therefore always true), `updateTypeSchema`/`updateTagSchema` (both would reset `display_order` to `0`). All four rewritten as independent schemas with no defaults. Re-verified live against the real DB: admin user PATCH now preserves a non-default role (`customer`) across an update; category PATCH now preserves both `display_order` and the linked type after an update that omits both.
10. **`updateBlog` didn't auto-fill `published_at` when status flips to `published` via PATCH** — only `createBlog` had that logic. Caught live: a blog PATCHed from `draft` to `published` showed `status: "published"` with `published_at: null`, which would've sorted it to the bottom of "recent" listings (`ORDER BY published_at DESC NULLS LAST`) despite being live. Fixed by applying the same auto-fill rule in `updateBlog`; verified a draft-then-publish PATCH now stamps `published_at`.
11. **Postgres CHECK-constraint violations (`23514`) weren't mapped in `errorHandler.ts`** — anticipated before it could bite: `blog_recommended` has `CHECK (blog_id != recommended_blog_id)`, which would have 500'd if ever hit. Added the mapping (→ 400) alongside the existing unique/FK ones; the blog controller also filters a blog's own id out of `recommended_blog_ids` before insert, so the DB constraint is defense-in-depth rather than the primary guard. Verified live via the filtering path (self-reference silently dropped, not rejected) — the raw constraint path itself wasn't separately exercised.
12. **Aayojan event slugs were checked against the wrong table.** `generateUniqueSlug(title, "services")` was used for `aayojan_events` create/update — copy-paste from the services controller. Would've checked slug collisions against the `services` table instead of `aayojan_events`, so two events could silently get the same slug (or a slug could be rejected as taken when it wasn't, if a service happened to share it). Caught before testing — added `aayojan_events` to the slug service's table whitelist and fixed both call sites.
13. **Payment double-processing race, caught during design (not shipped).** The webhook delivery and the client's own `verify-payment` call can legitimately arrive within milliseconds of each other. An earlier draft checked `payment.status !== 'captured'` with a plain `SELECT` before updating — both requests could pass that check before either committed, double-inserting `coupon_usages` and double-incrementing `coupons.usage_count`. Fixed before testing by moving the whole capture step (mark-captured + confirm-order + record-coupon-usage) into a single transaction with `SELECT ... FOR UPDATE` on the payment row, so whichever request gets there first wins and the other sees the already-captured status and no-ops. Verified live: re-delivering the same webhook event, and calling `verify-payment` twice for the same payment, both correctly short-circuit without re-processing.
14. **Razorpay signature comparisons used `===` instead of a constant-time compare** — fixed during design (not shipped as a bug): both the payment-signature and webhook-signature checks now use `crypto.timingSafeEqual`, closing a timing side-channel on a security-sensitive comparison.
15. **`GET /services/:id/reviews` had no query validation, causing a real 400 on the very first test.** The route read `req.query.page`/`req.query.limit` straight from an unvalidated cast, so with no query string at all they were `undefined`; `paginate()` computed `Math.max(1, undefined)` → `NaN`, which Postgres rejected as `22P02 invalid_text_representation` on the `LIMIT`/`OFFSET` parameters — surfaced to the client as a generic "Invalid value format" with no indication it was a missing-validation bug rather than a bad request. Fixed by adding a `listServiceReviewsQuerySchema` (reusing `paginationSchema`'s coercion/defaults) and wiring `validate(..., "query")` into the route. Found the same gap on `GET /admin/invoices` while checking for it elsewhere and fixed it there too, even though that controller's manual `Number(q.page) || 1` fallback happened to already be safe from this specific crash.
16. **`markBookingComplete` had a dead code branch, caught during a self-review before testing.** An early draft only recalculated pandit stats when the *caller* was the pandit (`if (req.user.role === "pandit") { ...recalculate... } else if (assignmentAfter) { /* admin completed it */ }`) — but `assignmentAfter` was fetched by matching the *admin's own* user id against `pandit_profiles.user_id`, which can never match (an admin isn't a pandit), so the admin branch was unreachable dead code and an admin completing a booking would silently never update that pandit's `total_bookings`/rating. Fixed by capturing the actual assignment row returned from the completion UPDATE itself (`completeAssignmentForOrder ... RETURNING *`) and recalculating based on *its* `pandit_id`, regardless of who made the request. Verified live: had admin complete a booking assigned to a different pandit, confirmed that pandit's `total_bookings` incremented correctly.
17. **Wrong import path for `completeAssignmentForOrder`, caught by typecheck before it ever ran.** Wrote the query in `pandit.queries.ts` but the controller tried to import it from `booking.queries.ts` (copy-paste from a neighboring import line) — `tsc` failed immediately since the export didn't exist there. Caught before any testing began.
18. **Every 422 across the entire API returned a flat `"Validation failed"` with no field detail.** `errorHandler.ts` caught `ZodError` and discarded `err.issues` entirely, so a request failing on 5 different fields looked identical to one failing on 1 — no way to tell a client which field was wrong or why. Surfaced by a real user request (`max_discount_amount: 0` on `POST /admin/coupons`, rejected by `.positive()`) that was genuinely hard to debug from the response alone. Fixed app-wide, not just for coupons: `error()` in `utils/response.ts` now accepts an optional `details: {field, message}[]`, and `errorHandler.ts` maps `err.issues` into it for every Zod validation failure everywhere in the API. Verified live: a single bad field now names itself exactly (`{"field":"max_discount_amount","message":"Number must be greater than 0"}`), and a payload broken on 7 fields at once lists all 7, not just the first.

---

## Known gaps / not yet wired

- WhatsApp OTP delivery: only a MSG91-shaped stub exists (`services/otp.service.ts`). In dev (`NODE_ENV !== production` or no `OTP_API_KEY`), OTP codes are logged to console instead of sent.
- Razorpay, S3 uploads: code is wired but untestable without real credentials (`.env` has dummy values). This means `POST/PATCH /admin/services`, `POST /admin/services/:id/images`, and any other file-upload endpoint can't be exercised end-to-end here — validation paths (missing required file, bad input) were tested; the actual S3 round-trip was not.
- `DELETE /admin/services/:id` doesn't yet block on active bookings ("Fails if active bookings exist" per spec) — the `orders`/bookings tables don't exist until Step 10/11. Guard to be added then.
- Service reviews (rating/comment, shown on `GET /services/:slug`) depend on the `bookings` table (Step 11) and aren't wired yet — `GET /services/:slug` omits the `reviews` field for now.
- `GET /home`'s `stats` (pujas_completed, connected_pandits) read from `app_settings` by key and default to `0` — nothing seeds those keys yet, and the settings admin CRUD itself (Step 13) doesn't exist, so for now they can only be set by direct SQL against `app_settings`.
- `recommended_services` table + its admin CRUD are built per spec, but `GET /home` does not surface them under a `recommended_services` key — the example home JSON in the spec doesn't include one, and the home page's `bestsellers` block is served by the same category/`is_bestseller`/`is_featured`-flag logic as `GET /services/bestsellers` (Step 5), not by this table. `recommended_services` is available as a general curation mechanism for other pages/sections once needed.
- Cron jobs (OTP cleanup, unpaid-order cancellation, assignment auto-expiry): not implemented yet (Step 14).
- Aayojan event reviews (`aayojan_event_reviews` table exists in schema) aren't wired up — the spec doesn't document an endpoint for them, and unlike service reviews there's no booking/order concept anywhere in this schema to verify someone actually attended an event before letting them review it. Revisit once/if that business rule is defined.
- ~~Coupon usage recording~~ — done in Step 10: `verify-payment`/webhook capture now insert into `coupon_usages` and increment `coupons.usage_count` when a coupon-bearing order is actually paid for.
- Razorpay order creation (`services/razorpay.service.ts`'s `createRazorpayOrder`) is wired but untestable end-to-end here — dummy credentials mean the real API call fails, so `POST /checkout/create-order` always ends at a graceful 502 after successfully creating the order+members rows. Everything up to and after that boundary (validation, transactional insert, signature verification, webhook handling, coupon usage recording) was tested by manually seeding a `payments` row and constructing correctly-signed requests with the dummy `RAZORPAY_KEY_SECRET`/`RAZORPAY_WEBHOOK_SECRET` already in `.env` — the HMAC math itself doesn't need a live Razorpay account, only the actual order-creation API call does.
- Unpaid orders (`status = 'pending'`, no captured payment) are never auto-cancelled — that's the Step 14 cron job. Until then a failed/abandoned checkout leaves the order sitting in `pending` indefinitely (and blocks a duplicate booking for that service+date+user via the "no duplicate pending order" check) until an admin manually cancels it or the cron job is built.
- WhatsApp payment-confirmation message (mentioned in the plan for `verify-payment`) isn't sent — no WhatsApp sending exists yet beyond the OTP stub; that's Step 12 (`notification.service.ts`).
- Invoice PDF generation itself works (verified — PDFKit produces the buffer with no errors), but the S3 upload that follows hits real AWS with dummy credentials, so `GET /bookings/:id/invoice` always ends in a 500 at that boundary. Same documented limitation as every other file-upload feature in this backend.
- `pandit_assignment_status` has no `'cancelled'` value, so freeing a pandit's calendar slot on booking cancellation reuses `'rejected'` (with `rejection_reason: 'Order cancelled'`) — the closest existing state, but semantically it reads as the pandit's own choice rather than a customer cancellation. Nothing populates `pandit_assignments` yet (Step 12 doesn't exist), so this path is currently unreachable in practice; revisit the exact semantics once the pandit flow is built — a dedicated enum value might be worth a migration at that point.
- Booking cancellation applies the 24-hour rule uniformly to both customers and admins, since the spec's edge-case list doesn't carve out an admin exception. If admins need to force-cancel within 24 hours for support cases, that needs an explicit ask — not assumed here.
- Auto-expiring stale pandit assignments (`respond_by < NOW() AND status = 'pending'` → `expired`, admin notified) is the Step 14 cron job and doesn't exist yet. Until then, an assignment past its 48-hour window just sits as `pending` — `acceptAssignment` does reject an accept attempt past `respond_by`, but nothing proactively flips the status or notifies admin that a reassignment is needed.
- `notification.service.ts` only writes rows to the `notifications` table — nothing reads them back yet (no `GET /notifications` endpoint exists in the spec or here) and no push/WhatsApp delivery happens. It's genuinely useful as an audit trail today, but not yet a real-time notification channel for the user.
- Pandit assignment reassignment reuses the same row (see above) rather than preserving each rejected/expired assignment as a separate historical record tied 1:1 to "who was offered this and when." If a full assignment history per order turns out to matter later, that's a schema/behavior change, not just a controller tweak.
- **Settings management and the activity log were deliberately not built in Step 13**, even though `backend-implementation-plan.md`'s phase list names both ("Settings — Key-value config management", "Activity log — Track admin actions"). `api-reference.md` — the authoritative endpoint contract — documents neither: no `GET/PATCH /admin/settings` and no `GET /admin/activity-log` anywhere in it. `app_settings` is still readable (convenience_fee, stats keys) but only settable via direct SQL as already noted; `activity_logs` exists in the schema but nothing writes to it — retrofitting audit-log writes across every admin mutation built in the last 12 steps would be a large, unrequested scope expansion rather than this step's actual deliverable. Flagging explicitly in case either was expected.
- Device tokens are stored (see above) but nothing sends a push yet — `services/notification.service.ts` (Step 12) still needs to actually call FCM/APNs/Web Push with the tokens from `listActiveTokensForUsers`. No push provider credentials exist in `.env` yet either.
