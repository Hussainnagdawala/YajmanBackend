# Yajman API Documentation

Base URL: `http://localhost:{PORT}/api/v1` (see `.env` for current `PORT`)
Auth: `Authorization: Bearer <access_token>` header, obtained from `/auth/verify-otp`
All responses share one envelope:

```json
// success
{ "success": true, "message": "...", "data": { ... }, "pagination": { ... } }
// error
{ "success": false, "error": { "message": "...", "status": 422, "code": "VALIDATION_ERROR", "details": [{"field":"...","message":"..."}] } }
```

`pagination` only appears on list endpoints. `details` only appears on Zod validation failures (422) — see `README.md` bug #18.

Uploads are `multipart/form-data`. Array fields inside a multipart body (e.g. `type_ids`, `key_features`) are sent as **JSON-stringified strings**, not repeated form fields — see `README.md`'s note on this.

---

## Which client uses which section

The backend is **one REST API** shared by every client — it does not branch behavior by "app" vs "website", or by "pandit portal" vs "pandit app". A client is only distinguished by **who's logged in** (JWT role) and, optionally, the `device_source` field sent at login (`web` | `app` | `portal` — cosmetic/analytics only, no route depends on it).

| Category you asked for               | Maps to section below                        |
| ------------------------------------ | -------------------------------------------- |
| **Website** (customer-facing)        | § 1. Customer APIs                           |
| **App** (customer mobile app)        | § 1. Customer APIs — identical to Website    |
| **Admin** (admin portal)             | § 2. Admin APIs                              |
| **Pandit Admin** (pandit web portal) | § 3. Pandit APIs                             |
| **Pandit App** (pandit mobile app)   | § 3. Pandit APIs — identical to Pandit Admin |

If Website and App (or Pandit Admin and Pandit App) ever need to diverge — e.g. app needs a mobile-only endpoint — that would be new, separate work; nothing in the current build treats them differently.

---

---

# § 1. Customer APIs (Website + Mobile App)

## Auth

### `POST /auth/send-otp`

No auth. Rate-limited: 3 requests / phone / 10 min.

```json
{ "phone": "9876543210", "country_code": "+91" }
```

→ `{ "success": true, "message": "OTP sent", "data": { "expires_in": 600 } }`

### `POST /auth/verify-otp`

No auth. Creates the user on first login.

```json
{
  "phone": "9876543210",
  "otp": "123456",
  "country_code": "+91",
  "device_source": "web"
}
```

→

```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOi...",
    "refresh_token": "ad1a556c...",
    "expires_in": 86400,
    "user": {
      "id": "uuid",
      "phone": "9876543210",
      "role": "customer",
      "name": null
    },
    "is_new_user": true
  }
}
```

### `POST /auth/refresh-token`

No auth. Refresh tokens rotate — the old one is invalidated the moment this is called.

```json
{ "refresh_token": "ad1a556c..." }
```

→ `{ "success": true, "data": { "access_token": "...", "refresh_token": "...", "expires_in": 86400 } }`

### `POST /auth/logout`

Auth required.

```json
{ "refresh_token": "ad1a556c..." }
```

→ `{ "success": true, "message": "Logged out", "data": null }`

### `GET /auth/me`

Auth required. Returns the full `users` row for the caller.

---

## Profile

### `GET /profile`

Auth required.

### `PATCH /profile`

Auth required. All fields optional — only send what's changing.

```json
{
  "name": "Hussain",
  "email": "hussain@example.com",
  "whatsapp_number": "7984561235",
  "calling_number": "7984561236",
  "gender": "Male",
  "date_of_birth": "1995-06-09",
  "time_of_birth": "12:00",
  "place_of_birth": "Indore"
}
```

### `POST /profile/avatar`

Auth required. Multipart, field `avatar` (single file, image only, ≤10MB).

### `POST /profile/device-tokens`

Auth required. Register/refresh a push token — call whenever the client obtains one (login, permission grant, token rotation), not just at login. Re-registering an existing token under a different logged-in user reassigns it.

```json
{
  "token": "fcm-or-apns-or-webpush-token",
  "platform": "web",
  "device_info": { "browser": "Chrome" }
}
```

`platform`: `"web" | "android" | "ios"`. `device_info` optional, freeform object.

### `GET /profile/device-tokens`

Auth required. Lists the caller's active devices.

### `DELETE /profile/device-tokens`

Auth required. Call on logout / push-permission revoked.

```json
{ "token": "fcm-or-apns-or-webpush-token" }
```

---

## Notifications (user inbox)

Auth required (`authenticate`). Soft-deleted rows are hidden from all list/detail endpoints.

### `GET /notifications`

Query: `page`, `limit`, `unread_only` (`true` to return unread only).

### `GET /notifications/unread-count`

Returns `{ "count": number }` for badge UI.

### `GET /notifications/:id`

Own notification detail only.

### `POST /notifications/:id/read`

Marks read (`is_read=true`, stamps `read_at`).

### `POST /notifications/read-all`

Marks all of the caller's unread notifications as read.

### `POST /notifications/:id/click`

Records `clicked_at` (and marks read). Use when the user opens a deep link / CTA.

### `DELETE /notifications/:id`

Soft-deletes one notification from the caller's history.

### `DELETE /notifications`

Clears the caller's entire notification history (soft-delete all).

Push payload `data` keys (when FCM is configured): `type`, `deep_link`, `action_type`, `action_value`, `campaign_id` and/or `notification_id`, plus transactional `reference_type` / `reference_id` when applicable.

---

## Admin Notifications (campaigns)

Admin auth required. Mounted at `/admin/notifications`.

User picker for “selected users” reuses existing `GET /admin/users` (search/pagination).

### `POST /admin/notifications`

Create a campaign. JSON or multipart (`image` optional file → S3 folder `notifications`).

```json
{
  "title": "Diwali Offer",
  "message": "Book any puja and get 10% off",
  "type": "promo",
  "target_type": "all",
  "target_user_ids": [],
  "deep_link": "yajman://home",
  "action_type": "open_screen",
  "action_value": "home",
  "scheduled_at": null
}
```

- `target_type`: `"all"` | `"selected"` (`group`/`topic` reserved for future).
- `target_user_ids` required (non-empty) when `target_type` is `"selected"`.
- If `scheduled_at` is a future datetime → status `scheduled`; otherwise `draft`.
- Does **not** send immediately — call `POST /:id/send` (or wait for the scheduler).

### `GET /admin/notifications`

Query: `page`, `limit`, `search`, `status`, `target_type`, `sort` (`created_at|sent_at|scheduled_at|title`), `order` (`asc|desc`), `from`, `to`.

### `GET /admin/notifications/:id`

Campaign detail plus paginated recipients (`page`/`limit`). Includes `read_count` / `click_count`.

### `PUT /admin/notifications/:id`

Update only when status is `draft` or `scheduled`. Multipart image optional.

### `DELETE /admin/notifications/:id`

Delete only when status is `draft`.

### `POST /admin/notifications/:id/send`

Resolves audience → writes inbox rows → FCM fan-out (no-op if Firebase unset) → sets status `sent`. Allowed from `draft` or `scheduled`.

### `POST /admin/notifications/:id/resend`

Clones a `sent`/`failed` campaign into a new campaign and sends it immediately.

### `POST /admin/notifications/:id/duplicate`

Clones into a new `draft` (does not send).

### `POST /admin/notifications/:id/cancel`

Cancels a `scheduled` campaign.

**Firebase env (optional locally):** `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, or `FIREBASE_SERVICE_ACCOUNT_PATH`. Without these, campaigns still create in-app inbox rows; push is skipped with a server warning.

**Migration:** `src/database/migrations/002_notification_campaigns.sql` (also applied by `yarn seed`).

---

## App Settings

### Public — `GET /app/settings`

No auth. Returns all `is_public` settings nested by category. Optional query: `platform=android|ios`, `app_version=1.2.0` — when both are present, response includes computed `version_check` (not stored).

Headers: `Cache-Control: public, max-age=60` and weak `ETag` (supports `If-None-Match` → 304).

Secrets (`razorpay_*`, `s3_*`, etc.) are never included.

### Admin — `/admin/app-settings`

Admin auth required.

| Method | Path                       | Behavior                                                       |
| ------ | -------------------------- | -------------------------------------------------------------- |
| GET    | `/admin/app-settings`      | All settings grouped by category (`?category=` optional)       |
| GET    | `/admin/app-settings/:key` | Single key (URL-encode dotted keys)                            |
| PUT    | `/admin/app-settings`      | Bulk upsert `{ "settings": { "android.force_update": true } }` |
| PATCH  | `/admin/app-settings/:key` | `{ "value": ... }`                                             |

Phase 1: only known seeded keys. Non-editable keys (secrets) return 403. Writes audit `activity_logs` (`entity_type = app_setting`) and invalidate the in-memory public cache.

**Migrations:** `003_app_settings_management.sql` + `004_app_settings_catalog_expand.sql` (also applied by `yarn seed`).

---

## Categories / Types / Tags (public)

### `GET /categories`

No auth. Active categories only, each with its linked `types` array and `type_count`.

### `GET /types`

No auth. Active types only.

### `GET /tags`

No auth. Active tags only.

---

## Services (public)

### `GET /services`

No auth. Query params (all optional):
`category` (slug or uuid), `type` (slug/uuid, comma-separated for multiple), `tag` (slug), `search`, `min_price`, `max_price`, `rating` (min), `sort` (`price_asc|price_desc|rating|newest|title`), `is_featured`, `is_bestseller`, `city`, `page`, `limit`.

### `GET /services/bestsellers`

No auth. App bestsellers — services with `is_bestseller = true` (active + published), **grouped by category**.

```
GET /api/v1/services/bestsellers
```

```json
{
  "data": [
    {
      "category": { "id": "...", "name": "...", "slug": "..." },
      "services": [ /* service rows */ ]
    }
  ]
}
```

Admin sets the flag via `is_bestseller` on create/update service.

### `GET /services/trending`

No auth. App trending / “trading” list — services with `is_featured = true` (active + published), **flat list** with pagination.

Query (optional): `page`, `limit` (default 20).

```
GET /api/v1/services/trending?page=1&limit=20
```

```json
{
  "success": true,
  "data": [ /* service rows with category_name, category_slug */ ],
  "pagination": { "page": 1, "limit": 20, "total": 8, "total_pages": 1, "has_next": false, "has_prev": false }
}
```

Admin sets the flag via `is_featured` on create/update service.

Alternatives (same filters on the general list):
- `GET /services?is_bestseller=true`
- `GET /services?is_featured=true`

### `GET /services/:slug`

No auth. Full detail: `images`, `types`, `tags`, `temples`, `key_features`, `packages`, `faqs` all included, joined arrays default to `[]`.

### `GET /services/:id/reviews`

No auth. Approved reviews only. Query: `page`, `limit`, `sort` (`newest|rating`).

### `POST /services/:id/reviews`

Auth required. Same effect as `POST /bookings/:id/review` below, but the booking id is in the body instead of the URL (and must belong to the service in the URL). Multipart, field `photos` (up to 5 images).

```
booking_id: uuid
rating: 5
title: "Great experience"   (optional)
comment: "Very good pandit"  (optional)
```

### `POST /services/:id/inquiry`

No auth. Service-specific lead form.

```json
{
  "name": "Ahmed",
  "phone": "7984561236",
  "email": "a@x.com",
  "message": "Available next week?"
}
```

---

## Reviews

See `POST /services/:id/reviews` and `POST /bookings/:id/review` (identical underlying logic, different entry points) and `GET /services/:id/reviews` above.

---

## Home

### `GET /banners`
No auth. App-facing banner list filtered by type (admin CMS tabs → DB `position`).

Query (required):
- `type`: `hero_slider` | `middle_ad` | `offer_banner` | `category_banner`
- alias: `position` (same values)

Returns only **active** banners whose date window is current (`starts_at`/`ends_at` null or valid), ordered by `display_order`.

```
GET /api/v1/banners?type=hero_slider
```

```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "title": "Tester Hero",
      "image_url": "http://localhost:3001/uploads/banners/....jpg",
      "mobile_image_url": null,
      "link_url": "https://...",
      "position": "hero_slider",
      "display_order": 0,
      "is_active": true,
      "starts_at": null,
      "ends_at": null
    }
  ]
}
```

### `GET /home`

No auth. Single aggregator:

```json
{
  "banners": [...],           // hero_slider position
  "popular_searches": [...],
  "testimonials": [...],       // page=home
  "bestsellers": { "puja_at_home": [...], "e_puja": [...] },  // keyed by category slug (dashes→underscores)
  "categories": [...],
  "offer_banner": {...} | null, // middle_ad position, first active one
  "recent_blogs": [...],
  "stats": { "pujas_completed": 0, "connected_pandits": 0 }  // reads app_settings, 0 until seeded
}
```

---

## Blogs (public)

### `GET /blogs`

No auth. Query: `category` (slug or uuid), `featured`, `page`, `limit`.

### `GET /blogs/:slug`

No auth. Full content, author, category, gallery `images`, `related_blogs`, `sidebar_services`.

---

## Aayojan (public)

### `GET /aayojan`

No auth. `{ content, events, banners, testimonials }` (testimonials page=aayojan).

### `GET /aayojan/events/:slug`

No auth. Single event detail with gallery `images`.

### `POST /aayojan/contact`

No auth.

```json
{
  "name": "Hussain",
  "email": "hussain@example.com",
  "phone": "7984561235",
  "city": "Indore",
  "event_name": "Sundarkand Mahotsav",
  "number_of_people": 50,
  "preferred_date": "2026-08-15"
}
```

---

## Contact Forms

### `POST /contact`

No auth. General lead form.

```json
{
  "name": "Hussain",
  "email": "hussain@example.com",
  "phone": "7984561235",
  "city": "Indore",
  "message": "..."
}
```

(Service-specific and Aayojan contact forms are listed under their own sections above.)

---

## Coupons

### `GET /coupons`

Auth required (any role). App-facing list of **active** coupons that are currently within `valid_from`–`valid_until` and under global `usage_limit` (if set). Ordered by soonest expiry.

Does **not** include inactive, expired, not-yet-started, or fully used coupons. Does **not** check per-user usage — use `POST /coupons/validate` before applying a code.

```
GET /api/v1/coupons
```

```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "code": "BUY10",
      "title": "10% Off",
      "description": "...",
      "discount_type": "percentage",
      "discount_value": "10.00",
      "max_discount_amount": "100.00",
      "min_order_amount": "0.00",
      "usage_limit": null,
      "usage_count": 3,
      "per_user_limit": 1,
      "valid_from": "...",
      "valid_until": "...",
      "applicable_categories": null,
      "applicable_services": null
    }
  ]
}
```

### `POST /coupons/validate`

Auth required (any role). Dry-run — always `200`, never a validation-failure error; check `data.valid`.

```json
{ "code": "BUY10", "service_id": "uuid", "amount": 899 }
```

→ success: `{ "valid": true, "discount_amount": 89.9, "final_amount": 809.1, "coupon": {"id":"...","code":"BUY10","title":"..."} }`
→ failure: `{ "valid": false, "message": "Coupon has expired" }`

---

## Checkout & Payments (Razorpay)

### `POST /checkout/create-order`

Auth required.

```json
{
  "service_id": "uuid",
  "booking_date": "2026-12-25",
  "booking_time": "10:00",
  "customer_name": "Hussain",
  "customer_phone": "7984561235",
  "customer_whatsapp": "7984561235",
  "customer_calling_number": null,
  "customer_email": "hussain@example.com",
  "members": ["Hussain", "Ahmed"],
  "gotra": "Bharadwaja",
  "gotra_unknown": false,
  "coupon_code": "BUY10",
  "address": "212 Satguru Parinay, AB Road, Vijay Nagar, Indore",
  "city": "Indore",
  "pincode": "452010",
  "special_instructions": "",
  "birth_date": null,
  "birth_time": null,
  "birth_place": null
}
```

→

```json
{
  "data": {
    "order": {
      "id": "uuid",
      "order_number": "YAJ2026072301",
      "total_amount": 809.1
    },
    "razorpay": {
      "order_id": "order_xxxx",
      "amount": 80910,
      "currency": "INR",
      "key_id": "rzp_live_xxxx"
    }
  }
}
```

Validates: service active, booking ≥24h out, no duplicate pending booking (same user+service+date), coupon re-validated server-side.

### `POST /checkout/verify-payment`

Auth required. Called after the Razorpay client-side callback.

```json
{
  "razorpay_order_id": "order_xxxx",
  "razorpay_payment_id": "pay_xxxx",
  "razorpay_signature": "xxxx"
}
```

→ `{ "data": { "order": {"id":"...","order_number":"...","status":"confirmed"}, "payment": {"status":"captured","method":"upi"} } }`

### `POST /checkout/webhook`

**No auth** — called directly by Razorpay, verified via `x-razorpay-signature` header against the raw body instead of a JWT. Not something a frontend ever calls.

---

## Bookings

### `GET /bookings`

Auth required. Query: `status` (`upcoming|completed|cancelled`), `page`, `limit`.

- upcoming = `pending|confirmed|pandit_assigned|in_progress` (includes past-date active bookings so they are not hidden)
- completed = `completed`
- cancelled = `cancelled|refunded|payment_failed|refund_failed|disputed`

### `GET /bookings/:id`

Auth required (owner or admin). Full detail: service snapshot, `members`, `pandit` (null if unassigned), `payment` (null if none), `review` (null if not yet reviewed).

### `PATCH /bookings/:id/cancel`

Auth required (owner or admin). Cannot cancel <24h before `booking_datetime`, or if status is `completed|cancelled|refunded`. Auto-refunds via Razorpay if payment was captured (refund failure is logged, doesn't block the cancellation).

```json
{ "reason": "Schedule changed" }
```

### `POST /bookings/:id/review`

Auth required. Booking must be `completed`. One review per booking. Multipart, field `photos` (up to 5 images).

```
rating: 5
title: "Amazing experience"   (optional)
comment: "The pandit was very knowledgeable..."  (optional)
```

### `GET /bookings/:id/invoice`

Auth required (owner or admin). Generates the PDF + uploads to S3 on first call, returns the cached URL on every call after.
→ `{ "data": { "invoice_number": "INV-2026-0001", "pdf_url": "https://..." } }`

---

---

# § 2. Admin APIs (Admin Portal)

All routes below require `Authorization: Bearer <admin_access_token>` (role `admin`) and are mounted under `/admin/*`.

## Users

### `POST /admin/users`

Creates a user directly (used to onboard pandits/other admins — no OTP flow needed).

```json
{
  "phone": "9876543210",
  "name": "Sandeep Sharma",
  "role": "pandit",
  "email": "sandeep@example.com"
}
```

### `GET /admin/users`

Query: `role`, `status`, `search`, `page`, `limit`.

### `GET /admin/users/:id`

### `PATCH /admin/users/:id`

All fields optional (`phone`, `name`, `role`, `email`) — omitted fields are left untouched, including `role`.

### `PATCH /admin/users/:id/status`

```json
{ "status": "suspended" }
```

(`active | inactive | suspended`)

---

## Categories / Types / Tags

### `POST /admin/categories` — multipart

```
name: "Puja At Home"
description: "Book pandits for home pujas"
type_ids: ["uuid1","uuid2"]   (JSON string)
display_order: 1
meta_title: "..."
meta_description: "..."
Files: image, icon
```

### `GET /admin/categories` — all, including inactive, with linked `types`/`type_count`

### `GET /admin/categories/:id`

### `PATCH /admin/categories/:id` — same fields, all optional, multipart

### `DELETE /admin/categories/:id` — soft delete, `409` if any service references it

### `POST /admin/types` — multipart, `{name, description, display_order}` + file `image`

### `GET /admin/types`

### `PATCH /admin/types/:id`

### `DELETE /admin/types/:id` — soft delete

### `POST /admin/tags` — `{name, color, bg_color, display_order}` (hex colors, e.g. `#ffffff`)

### `GET /admin/tags`

### `PATCH /admin/tags/:id`

### `DELETE /admin/tags/:id` — soft delete

---

## Services / Temples

### `POST /admin/services` — multipart, transactional (service row + type/tag/temple junctions + key_features/packages/faqs all committed or rolled back together)

```
title: "Shravana Special Parthiv Shivling Nirmaan and Abhishek"
category_id: uuid
type_ids: ["uuid1","uuid2"]        (JSON string)
tag_ids: ["uuid1"]                 (JSON string)
temple_ids: ["uuid1"]               (JSON string, optional)
price: 899
original_price: 2000
short_description / about_puja / description: text
custom_content: "<h2>...</h2>"      (HTML, sanitized with DOMPurify server-side)
location / city / state / pincode / latitude / longitude
video_url
duration_minutes: 90
advance_booking_hours: 24
is_featured / is_bestseller: true
display_order: 0
key_features: '[{"title":"1 Pandit","description":"Experienced"}]'   (JSON string)
packages: '[{"title":"Basic","items":[{"name":"Samagri","quantity":1,"unit":"set"}],"price":500}]'  (JSON string)
faqs: '[{"question":"What is included?","answer":"..."}]'            (JSON string)
meta_title / meta_description
Files: feature_image (required, single), images (gallery, up to 20)
```

### `GET /admin/services` — query: `category_id`, `status`, `is_active`, `sort`, `page`, `limit`

### `GET /admin/services/:id`

### `PATCH /admin/services/:id` — same shape, all fields optional (omitting a field/array leaves it untouched; sending `[]` explicitly clears it)

### `DELETE /admin/services/:id` — soft delete

### `POST /admin/services/:id/images` — multipart, field `images` (gallery add-on, up to 20)

### `DELETE /admin/services/:id/images/:imageId` — also deletes the file from S3

### `POST /admin/temples` — `{name, description, address, city, state, latitude, longitude}`

### `GET /admin/temples`

### `PATCH /admin/temples/:id`

### `DELETE /admin/temples/:id` — soft delete

---

## Home Page Content

### `POST/GET/PATCH/DELETE /admin/banners` — multipart, `{title, subtitle, description, link_url, cta_text, position, discount_text, bg_color, text_color, display_order, starts_at, ends_at}` + files `image` (required), `mobile_image` (optional). `position`: `hero_slider|middle_ad|offer_banner|category_banner`.

### `POST/GET/PATCH/DELETE /admin/popular-searches` — `{label, link_url, display_order, row_number}` (`row_number`: 1 = tag chips row, 2 = text links row)

### `POST/GET/PATCH/DELETE /admin/testimonials` — multipart, `{author_name, author_designation, quote, rating, page, display_order}` + optional file `avatar`. `page`: `home|aayojan`.

### `POST/GET/PATCH/DELETE /admin/recommended-services` — `{service_id, page, section, display_order}`. Generic curation table — not currently surfaced by `GET /home` (see README gaps).

---

## Blogs

### `POST /admin/blogs` — multipart, transactional

```
title: "Grand Sundarkand Mahotsav"
category_id / author_id: uuid       (both optional)
excerpt: text
content: "<h2>...</h2>"             (HTML, sanitized)
is_featured: true
status: "draft" | "published" | "archived"
published_at: ISO datetime           (auto-filled with now() if status=published and omitted, on both create AND update)
recommended_blog_ids: ["uuid1","uuid2"]  (JSON string; a blog's own id is filtered out automatically)
meta_title / meta_description
Files: feature_image (optional, single), images (gallery, up to 20)
```

### `GET /admin/blogs` — query: `status`, `category_id`, `page`, `limit` (not in original spec, added since PATCH/DELETE need a way to discover ids)

### `PATCH /admin/blogs/:id`

### `DELETE /admin/blogs/:id` — soft delete via `status='archived'`

### `POST/GET/PATCH/DELETE /admin/blog-categories` — `{name, description, display_order}`

### `POST/GET/PATCH/DELETE /admin/blog-authors` — `{name, bio, user_id}` (`user_id` optional, links to an admin account)

---

## Aayojan

### `POST/GET/PATCH/DELETE /admin/aayojan/content` — multipart, `{section_key, title, subtitle, description, cta_text, cta_link, display_order}` + optional file `image`. `section_key` is unique (e.g. `hero`, `about`, `features`, `cta`).

### `POST/GET/PATCH/DELETE /admin/aayojan/events` — multipart, `{title, description, short_description, location, city, event_date, event_time, price, original_price, max_capacity, status}` + files `feature_image`, `images`.

### `POST/GET/PATCH/DELETE /admin/aayojan/banners` — multipart, `{title, link_url, display_order}` + required file `image`.

---

## Coupons

### `POST /admin/coupons`

```json
{
  "code": "BUY10",
  "title": "10% off first booking",
  "description": "Get 10% off on your first puja booking",
  "discount_type": "percentage",
  "discount_value": 10,
  "max_discount_amount": 200,
  "min_order_amount": 500,
  "usage_limit": 1000,
  "per_user_limit": 1,
  "valid_from": "2026-07-01T00:00:00Z",
  "valid_until": "2026-12-31T23:59:59Z",
  "applicable_categories": ["uuid1"],
  "applicable_services": []
}
```

Rules: `code` 3-30 chars (auto-uppercased); `discount_value`/`max_discount_amount`/`min_order_amount` must be > 0 if provided (`0` fails — omit instead of sending `0`); `usage_limit`/`per_user_limit` must be ≥1 if provided; `valid_until` must be after `valid_from`.

### `GET /admin/coupons`

### `PATCH /admin/coupons/:id` — all fields optional, independently

### `DELETE /admin/coupons/:id` — soft delete

---

## Contact Entries

### `GET /admin/contact-entries` — query: `form_type` (`general|service|aayojan`), `status` (`new|in_progress|resolved|closed`), `page`, `limit`

### `PATCH /admin/contact-entries/:id`

```json
{
  "is_read": true,
  "status": "in_progress",
  "admin_notes": "Called back",
  "assigned_to": "admin-user-uuid"
}
```

---

## Reviews (moderation)

### `PATCH /admin/reviews/:id` — approve/reject/reply, recalculates the service's `rating_avg`/`total_reviews`

```json
{ "is_approved": false, "admin_reply": "Thanks for the feedback" }
```

### `DELETE /admin/reviews/:id` — also recalculates the service's rating

---

## Invoices

### `GET /admin/invoices` — query: `from`, `to` (both `YYYY-MM-DD`), `page`, `limit`

---

## Pandits (browse profiles)

Distinct from "Pandit Assignments" below — this lists `pandit_profiles`, not assignment records. Use it to power an admin picker (search/filter, then feed the resulting `id` into `POST /admin/pandit-assignments` as `pandit_id`).

### `GET /admin/pandits` — query: `search` (matches display_name or phone), `is_available`, `is_verified`, `page`, `limit`

### `GET /admin/pandits/:id` — single profile, joined with phone/email/user_status

Note: a pandit's `pandit_profiles` row doesn't exist until they've called `GET`/`PATCH /pandit/profile` at least once (see § 3) — a pandit created via `POST /admin/users` but who has never logged in won't show up here yet.

## Pandit Assignments

### `POST /admin/pandit-assignments` — assigns a pandit to an order, sets `respond_by` = now + 48h, order status → `pandit_assigned`. Blocked if order is cancelled/completed/refunded, or if the pandit already has an _accepted_ booking at that exact date+time.

```json
{ "order_id": "uuid", "pandit_id": "pandit_profile_uuid" }
```

### `GET /admin/pandit-assignments` — query: `status`, `expiring` (`true` = pending assignments with `respond_by` within the next 12h — a threshold not specified in the source plan, chosen here), `page`, `limit`

### `PATCH /admin/pandit-assignments/:id/reassign` — re-purposes the same assignment row for a new pandit (fresh `respond_by`, status reset to `pending`), rather than creating a new row

```json
{ "pandit_id": "new_pandit_profile_uuid" }
```

---

## Dashboard

### `GET /admin/dashboard`

```json
{
  "total_orders": 1250,
  "total_revenue": 998750, // sum of CAPTURED payments only, not raw order totals
  "pending_orders": 12, // status in pending|confirmed|pandit_assigned|in_progress
  "active_pandits": 45, // role=pandit AND status=active user accounts
  "orders_today": 8,
  "revenue_today": 7192,
  "recent_orders": [
    /* last 10 */
  ],
  "pending_assignments": [
    /* next 10 by respond_by */
  ]
}
```

---

## Orders

### `GET /admin/orders` — query: `status` (`all` or any booking_status), `from`, `to`, `search` (order_number/customer_name/phone), `page`, `limit`

### `GET /admin/orders/:id` — full detail: `members`, `payment`, `assignment`, `invoice`, `review`, all null-safe

### `PATCH /admin/orders/:id/status` — direct status override, **no side effects** (no refund logic — for that, use the customer-facing `PATCH /bookings/:id/cancel` instead)

```json
{ "status": "completed", "notes": "Marked as completed by admin" }
```

---

---

# § 3. Pandit APIs (Pandit Portal + Pandit App)

All routes require `Authorization: Bearer <pandit_access_token>` (role `pandit`), mounted under `/pandit/*`, except `bookings/:id/complete` which also accepts `admin`.

## Profile

### `GET /pandit/profile`

Auto-provisions the `pandit_profiles` row on first call if it doesn't exist yet (no separate create-profile endpoint exists).

### `PATCH /pandit/profile`

All fields optional.

```json
{
  "display_name": "Pandit Sandeep Sharma",
  "bio": "Experienced pandit with 10 years...",
  "experience_years": 10,
  "specializations": ["Satyanarayan Puja", "Griha Pravesh"],
  "languages": ["Hindi", "Sanskrit"],
  "service_areas": ["Indore", "Bhopal"],
  "is_available": true
}
```

## Dashboard

### `GET /pandit/dashboard`

```json
{
  "pending_assignments_count": 2,
  "today_bookings_count": 1,
  "upcoming_bookings": [
    /* next 10 accepted bookings */
  ],
  "stats": { "total_completed": 12, "rating_avg": 4.8 }
}
```

## Assignments

### `GET /pandit/assignments` — query: `status` (`pending|accepted|rejected|expired|completed`), `page`, `limit`

### `GET /pandit/assignments/:id` — full detail with order/service info

### `PATCH /pandit/assignments/:id/accept` — must be within the 48h `respond_by` window; blocked if it'd double-book the pandit at that date+time

```json
{ "notes": "Will arrive 30 min early" }
```

### `PATCH /pandit/assignments/:id/reject`

```json
{ "reason": "Not available on this date" }
```

(Admin gets an in-app notification to reassign.)

## Bookings

### `GET /pandit/bookings` — query: `date` (`YYYY-MM-DD`, optional — omit for all accepted upcoming bookings)

### `PATCH /pandit/bookings/:id/complete` — pandit **or admin**; recalculates whichever pandit was actually assigned regardless of who calls this

---

## Notifications (in-app + FCM)

### User inbox

- `GET /notifications` — paginated history (`unread_only` optional)
- `GET /notifications/unread-count`
- `GET /notifications/:id`
- `POST /notifications/:id/read` · `POST /notifications/read-all`
- `POST /notifications/:id/click`
- `DELETE /notifications/:id` · `DELETE /notifications` (clear history)

### Admin campaigns

- `POST/GET/PUT/DELETE /admin/notifications`
- `POST /admin/notifications/:id/send|resend|duplicate|cancel`
- Selected-user picker: reuse `GET /admin/users`
- Optional image upload (S3 folder `notifications`)
- Scheduled sends via `node-cron` every minute
- Apply migration: `psql -f src/database/migrations/002_notification_campaigns.sql` (or `yarn seed`)

Transactional events (pandit assigned/accepted/rejected/completed) still call `createNotification()`, which now also best-effort pushes via FCM when credentials are configured.

---

## Known gaps (things intentionally not built — see `README.md` for full detail)

- Browsing the admin activity log UI — `activity_logs` is written for notification campaigns and app setting updates, but there is still no `GET /admin/activity-log` endpoint.
- Cron jobs: OTP cleanup, unpaid-order auto-cancel, stale pandit-assignment auto-expiry — still not implemented (notification scheduling cron **is** implemented).
- WhatsApp notification delivery — still not built (FCM push **is** implemented when Firebase env is set).
- Aayojan event reviews (`aayojan_event_reviews` table exists in schema) — no endpoint, no booking/attendance concept to gate who can review an event.
- User-group / topic / city / subscription targeting for campaigns — schema reserves `group`/`topic` on `target_type`; not wired yet.
- Redis/Bull queue for very large broadcasts — Phase 1 sends in-process in FCM batches of 500.
