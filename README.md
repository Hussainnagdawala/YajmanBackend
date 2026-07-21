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

Server listens on `PORT` (default `3001`). Health check: `GET /health`.
All API routes are mounted under `/api/{API_VERSION}` (default `/api/v1`).

---

## Database setup (fresh machine / fresh DB)

```bash
PGBIN="E:\PostgreSQL\pgsql\bin"
"$PGBIN/createdb.exe" -U postgres -h localhost -p 5432 yajman
"$PGBIN/psql.exe" -U postgres -h localhost -p 5432 -d yajman -f src/database/schema.sql
"$PGBIN/psql.exe" -U postgres -h localhost -p 5432 -d yajman -f src/database/seed.sql
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
| 5. Services | ⏳ next |
| 6–14 | not started |

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

All routes wired per the registration pattern in `CLAUDE-CODE-BACKEND-INSTRUCTIONS.md` (`/auth` public, `/profile` behind `authenticate`, `/admin` behind `authenticate + requireRole("admin")`).

### Bugs found and fixed during build/testing

1. **OTP storage:** `otp_verifications.otp_code` is `VARCHAR(6)` in schema (plaintext by design) — initial implementation stored a bcrypt hash (60 chars), which failed the column constraint. Switched to plaintext comparison; the 6-digit space is protected by attempt-limits, not hashing.
2. **Admin list-users query:** `countUsers` referenced `$3` with no `$1`/`$2` in its own statement text (shared placeholder numbering with the paginated list query) → Postgres couldn't infer parameter types (`42P18`). Filter-value numbering is now independent of the `LIMIT`/`OFFSET` params.
3. **`date_of_birth` off-by-one-day:** `pg` parses `DATE` columns into a JS `Date` at UTC midnight; serializing to JSON in IST (+5:30) rolled it back a day. Fixed at the driver level (`types.setTypeParser` for the DATE OID in `config/database.ts`), so it's corrected for every current and future DATE column, not just this one.
4. **Seed data phone format:** see [Database setup](#database-setup) above.
5. **ts-node + ambient types:** `types/express.d.ts` (the `req.user` augmentation) was silently skipped by ts-node's lazy per-file compilation, causing a real type error the moment auth-guarded routes were wired in. Fixed via `"ts-node": { "files": true }` in `tsconfig.json`.
6. **Postgres constraint violations → raw 500s:** any unique/foreign-key/type violation (e.g. duplicate category name) fell through to a generic 500 instead of a proper 4xx. Fixed centrally in `middleware/errorHandler.ts` — maps common Postgres error codes (`23505` unique violation, `23503` FK violation, `22P02` invalid input syntax, `22001` value too long) to 409/400 responses, app-wide, not just for categories.
7. **Single-category fetch missing the types join:** `GET /admin/categories/:id` returned bare category columns while the list endpoints included the joined `types`/`type_count`. Made `findCategoryById` consistent with the list queries.

---

## Known gaps / not yet wired

- WhatsApp OTP delivery: only a MSG91-shaped stub exists (`services/otp.service.ts`). In dev (`NODE_ENV !== production` or no `OTP_API_KEY`), OTP codes are logged to console instead of sent.
- Razorpay, S3 uploads: code is wired but untestable without real credentials (`.env` has dummy values).
- Cron jobs (OTP cleanup, unpaid-order cancellation, assignment auto-expiry): not implemented yet (Step 14).
