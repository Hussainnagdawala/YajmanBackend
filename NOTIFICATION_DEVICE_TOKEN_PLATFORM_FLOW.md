# Notification Device Token & Platform Flow

Complete guide for **multi-device, multi-platform push notifications** in the Yajman backend — covering Mobile APP and Website clients.

**Base URL:** `http://localhost:{PORT}/api/v1`

**Related docs:**
- [LOGIN_DEVICE_TOKEN_INTEGRATION.md](./LOGIN_DEVICE_TOKEN_INTEGRATION.md) — login-specific device token details
- [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) — full API reference

---

## Root cause (Website login → empty `device_tokens`)

The Admin send API and `device_tokens` table were not the primary failure.

**Root cause:** the Website never obtained or registered a Web Push token.

`YajmanWebAPP` already has the full client flow (`src/lib/deviceToken.ts` → `POST /profile/device-tokens`), but it was a no-op because **Firebase Web App env vars were not set**. There was no `YajmanWebAPP/.env` or `.env.local`. `isWebPushConfigured()` returned false, so:

```text
Website Login
  → no Notification permission prompt
  → getToken() never called
  → POST /profile/device-tokens never called
  → device_tokens stays empty
  → POST /admin/notifications/:id/send finds 0 web tokens
  → no browser popup
```

### Required Website env (`YajmanWebAPP/.env.local`)

Copy from `.env.example`, then fill Firebase **Web app** keys (not the Admin SDK private key):

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1

# Firebase Console → Project settings → Your apps → Web app
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=yajman-81a78.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=yajman-81a78
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=yajman-81a78.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

# Firebase Console → Project settings → Cloud Messaging → Web Push certificates → Key pair
NEXT_PUBLIC_FIREBASE_VAPID_KEY=...
```

Restart `next dev` after saving. Then:

1. Log in on the Website (allow the browser notification prompt).
2. Confirm DevTools console: `[WEB_PUSH] Token generated: true` and `[WEB_PUSH] Device registered`.
3. Confirm Network: `POST /api/v1/profile/device-tokens` → `201`.
4. Confirm DB: `SELECT user_id, platform, is_active FROM device_tokens;` → `platform=web`, `is_active=true`.
5. Send `POST /api/v1/admin/notifications/:id/send`.

Use a **customer** account for `target_type: all` campaigns (audience is `role = customer`). Admins are not included in “all”.

---
---

## 1. Objective

Support push notifications for both:

- **Mobile APP** (Android / iOS via FCM)
- **Website** (Web Push via FCM)

The backend must know, for each registered session:

```text
Which user?
Which device/session?
Which platform channel?   (app | web)
Which push token?
Is the token active?
```

When a notification is sent, the backend resolves active device records and delivers through Firebase Cloud Messaging (FCM).

---

## 2. Architecture

```text
                    User Login
                        │
             ┌──────────┴──────────┐
             │                     │
          Mobile APP             Website
             │                     │
        FCM Device Token      Web Push Token
             │                     │
             └──────────┬──────────┘
                        │
                        ▼
              POST /auth/verify-otp
              POST /profile/device-tokens
                        │
                        ▼
                 device_tokens table
                   (multi-device)
                        │
             ┌──────────┴──────────┐
             │                     │
        platform=app           platform=web
      (android / ios)          (browser)
             │                     │
             └──────────┬──────────┘
                        │
                        ▼
                  FCM (Firebase)
                        │
             ┌──────────┴──────────┐
             │                     │
        Mobile Push            Web Push
```

---

## 3. Storage Model

### Do NOT use `user.device_token`

A single token column on the user record cannot support:

```text
iPhone + Android + Chrome + Safari (same user, same time)
```

Instead, Yajman uses the **`device_tokens`** table — one row per device/session token.

### Table: `device_tokens`

| Column | Type | Description |
| ------ | ---- | ----------- |
| `id` | UUID | Primary key |
| `user_id` | UUID | Owner (FK → `users`) |
| `token` | TEXT | FCM/Web Push token (**UNIQUE** globally) |
| `platform` | enum | FCM routing: `android` \| `ios` \| `web` |
| `device_info` | JSONB | Metadata: `channel`, `device_type`, `browser`, `device_source` |
| `is_active` | boolean | `false` on logout or invalid token |
| `last_used_at` | timestamp | Updated on each registration/login |
| `created_at` | timestamp | First registration |

### Metadata in `device_info`

| Key | Values | Description |
| --- | ------ | ----------- |
| `channel` | `app` \| `web` | Delivery channel (API-level `platform`) |
| `device_type` | `android` \| `ios` \| `browser` | Device detail |
| `browser` | string | e.g. `chrome`, `safari` (web only) |
| `device_source` | `web` \| `app` \| `portal` | Login analytics label |

**Example — Android APP:**

```json
{
  "user_id": "USER_UUID",
  "token": "FCM_ANDROID_TOKEN",
  "platform": "android",
  "device_info": {
    "channel": "app",
    "device_type": "android",
    "device_source": "app"
  },
  "is_active": true
}
```

**Example — Chrome Website:**

```json
{
  "user_id": "USER_UUID",
  "token": "WEB_PUSH_TOKEN",
  "platform": "web",
  "device_info": {
    "channel": "web",
    "device_type": "browser",
    "browser": "chrome",
    "device_source": "web"
  },
  "is_active": true
}
```

---

## 4. Platform Values (API Contract)

### `platform` — delivery channel

Controlled values sent by clients:

```text
app    → mobile push (Android / iOS)
web    → browser push
```

### `device_type` — device detail

```text
android   → Android phone/tablet
ios       → iPhone/iPad
browser   → Web browser
```

### Mapping (API → database)

| Client sends | Stored `platform` | `device_info.channel` | `device_info.device_type` |
| ------------ | ----------------- | --------------------- | ------------------------- |
| `platform: app`, `device_type: android` | `android` | `app` | `android` |
| `platform: app`, `device_type: ios` | `ios` | `app` | `ios` |
| `platform: web`, `device_type: browser` | `web` | `web` | `browser` |

### Backward compatibility

Legacy clients may still send `platform: android | ios | web` directly. These are accepted and mapped automatically.

---

## 5. Login API

Yajman uses **OTP login**, not email/password.

### Endpoint

```text
POST /api/v1/auth/verify-otp
```

### Request fields

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `phone` | string | **Yes** | 10-digit mobile number |
| `otp` | string | **Yes** | 6-digit OTP |
| `country_code` | string | No | Default `+91` |
| `device_source` | string | No | `web` \| `app` \| `portal` |
| `device_token` | string | No | Push token |
| `platform` | string | No | `app` \| `web` |
| `device_type` | string | No | `android` \| `ios` \| `browser` |
| `browser` | string | No | Browser name (web clients) |

### APP login example

```json
{
  "phone": "9876543210",
  "otp": "123456",
  "country_code": "+91",
  "device_source": "app",
  "device_token": "FCM_DEVICE_TOKEN",
  "platform": "app",
  "device_type": "android"
}
```

### Website login example

```json
{
  "phone": "9876543210",
  "otp": "123456",
  "country_code": "+91",
  "device_source": "web",
  "device_token": "WEB_PUSH_TOKEN",
  "platform": "web",
  "device_type": "browser",
  "browser": "chrome"
}
```

### Login without token (unchanged)

```json
{
  "phone": "9876543210",
  "otp": "123456"
}
```

### Login response (unchanged)

```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOi...",
    "refresh_token": "...",
    "expires_in": 86400,
    "user": { "id": "...", "phone": "...", "role": "customer", "name": null },
    "is_new_user": false
  }
}
```

No `device_token` is returned in the response.

---

## 6. Login Processing Flow

```text
POST /auth/verify-otp
        │
        ▼
Validate OTP
        │
   ┌────┴────┐
   │ FAIL    │ → 400 error (token NOT stored)
   └────┬────┘
        │ PASS
        ▼
Find or create user
        │
        ▼
device_token provided and non-empty?
        │
   ┌────┴────┐
   │ YES     │ → Upsert device_tokens row
   │ NO      │ → Skip
   └────┬────┘
        ▼
Return existing login response
```

**Rules:**
- Authentication is never blocked by missing notification permission or token
- Empty `device_token` (`""`) is ignored — does not overwrite existing tokens
- Token is stored only after successful OTP verification

---

## 7. Multi-Device Support

Each device/session gets its own row. Logging in from a new device **does not overwrite** other devices.

```text
User A logs in on Android  → Token A (platform=app)
User A logs in on Chrome   → Token B (platform=web)

Database:
  User A → Token A (android, active)
  User A → Token B (web, active)

Both receive notifications.
```

### Duplicate prevention

Tokens are **UNIQUE** globally. Re-login with the same token updates:

```text
last_used_at, is_active=true, user_id (if reassigned)
```

No duplicate rows for the same token.

---

## 8. Device Token API (Token Refresh)

Dedicated endpoint for token refresh without re-login:

```text
POST /api/v1/profile/device-tokens
Authorization: Bearer <access_token>
```

### APP example

```json
{
  "device_token": "NEW_FCM_TOKEN",
  "platform": "app",
  "device_type": "android"
}
```

### Website example

```json
{
  "device_token": "NEW_WEB_PUSH_TOKEN",
  "platform": "web",
  "device_type": "browser",
  "browser": "chrome"
}
```

### Other device token endpoints

| Method | Endpoint | Auth | Purpose |
| ------ | -------- | ---- | ------- |
| `POST` | `/profile/device-tokens` | Yes | Register / refresh token |
| `GET` | `/profile/device-tokens` | Yes | List active tokens for user |
| `DELETE` | `/profile/device-tokens` | Yes | Deactivate a token |

**Security:** User identity comes from the JWT. Clients must **not** send `user_id`.

**Legacy alias:** `token` field is accepted instead of `device_token` on profile endpoints.

---

## 9. Logout Flow

```text
POST /api/v1/auth/logout
Authorization: Bearer <access_token>
```

```json
{
  "refresh_token": "...",
  "device_token": "TOKEN_TO_DEACTIVATE"
}
```

| Field | Required | Description |
| ----- | -------- | ----------- |
| `refresh_token` | No | Revokes the refresh session |
| `device_token` | No | Marks this device's push token `is_active = false` |

**Example after Android logout:**

```text
User A
 ├── Android Token → inactive
 └── Web Token     → active
```

Records are **not deleted** — only deactivated for audit and re-activation on next login.

Alternative: `DELETE /profile/device-tokens` with `{ "device_token": "..." }`.

---

## 10. Notification Sending Flow

Yajman uses **notification campaigns** (admin API), not a literal `/notifyUser` endpoint. The flow is equivalent:

```text
Admin creates campaign
        ↓
POST /admin/notifications/:id/send
        ↓
Resolve target users (all | selected)
        ↓
Insert per-user inbox rows (notifications table)
        ↓
Query active device_tokens for target users
        ↓
Fan out via FCM (all active tokens)
        ↓
Deactivate invalid tokens returned by FCM
```

### Individual user notification

```json
{
  "title": "Testing",
  "message": "Hello",
  "target_type": "selected",
  "target_user_ids": ["USER_UUID"]
}
```

Backend:

```text
USER_UUID
  ↓
Find active device_tokens
  ↓
app tokens (android/ios) + web tokens (web)
  ↓
FCM multicast to all tokens
```

### All users notification

```json
{
  "title": "Testing",
  "message": "Hello",
  "target_type": "all"
}
```

Backend:

```text
All active customers
  ↓
All active device_tokens
  ↓
FCM batch send
```

### Transactional notifications

Booking updates, payment confirmations, etc. use `createNotification()` in `notification.service.ts` — same device token resolution and FCM fan-out.

### Push payload (preserved)

```json
{
  "title": "Testing",
  "body": "Hello",
  "data": {
    "type": "promo",
    "notification_id": "...",
    "deep_link": "",
    "campaign_id": "..."
  }
}
```

---

## 11. Invalid Token Handling

When FCM returns an invalid/unregistered token:

```text
FCM error (registration-token-not-registered, etc.)
        ↓
Token added to invalidTokens list
        ↓
UPDATE device_tokens SET is_active = false
```

Implemented in `src/services/fcm.service.ts`. Invalid tokens are not retried.

---

## 12. Read / Unread Status

Notification read status is **user-level**, not device-level.

```text
User A marks notification 123 as read
  → is_read = true on notifications row
  → applies regardless of which device received the push
```

Inbox APIs: `GET /notifications`, `PATCH /notifications/:id/read`, etc.

---

## 13. APP Client Integration

### Login flow

```text
1. User enters phone + OTP
2. Get FCM token: FirebaseMessaging.instance.getToken()
3. POST /auth/verify-otp with device_token + platform=app + device_type
4. Store access_token / refresh_token
5. Continue app flow
```

### Flutter example

```dart
final fcmToken = await FirebaseMessaging.instance.getToken();

await api.post('/auth/verify-otp', body: {
  'phone': phone,
  'otp': otp,
  'device_source': 'app',
  if (fcmToken != null) 'device_token': fcmToken,
  'platform': 'app',
  'device_type': Platform.isIOS ? 'ios' : 'android',
});
```

### Token refresh (while logged in)

```dart
FirebaseMessaging.instance.onTokenRefresh.listen((newToken) async {
  await api.post('/profile/device-tokens', body: {
    'device_token': newToken,
    'platform': 'app',
    'device_type': Platform.isIOS ? 'ios' : 'android',
  });
});
```

### Logout

```dart
await api.post('/auth/logout', body: {
  'refresh_token': refreshToken,
  'device_token': fcmToken,
});
```

### Permission denied

Do **not** block login. Send login without `device_token`.

---

## 14. Website Client Integration

### Login flow

```text
1. Request notification permission (if desired)
2. Get Web Push / FCM web token from service worker
3. POST /auth/verify-otp with device_token + platform=web
4. Continue website flow
```

### Example

```json
{
  "phone": "9876543210",
  "otp": "123456",
  "device_source": "web",
  "device_token": "WEB_PUSH_TOKEN",
  "platform": "web",
  "device_type": "browser",
  "browser": "chrome"
}
```

### Token refresh

```text
Service worker / FCM onTokenRefresh
        ↓
POST /profile/device-tokens (authenticated)
```

### Foreground notifications

Handle in the website separately — show toast/banner when the tab is active. Do not rely only on OS/browser background notifications.

### Permission denied

Login proceeds without `device_token`.

---

## 15. Security Rules

| Rule | Implementation |
| ---- | -------------- |
| Token tied to authenticated user | JWT identity on profile endpoints; login stores after OTP |
| No cross-user registration | `user_id` from server, never from client body |
| No token in login response | Response unchanged |
| No full token in logs | Masked: `abcd...xyz` |
| No token on failed auth | OTP must pass first |

---

## 16. Backward Compatibility

| Scenario | Status |
| -------- | ------ |
| Login without `device_token` / `platform` | ✅ Works |
| Legacy `platform: android/ios/web` | ✅ Accepted |
| Legacy `token` field on profile API | ✅ Accepted as alias |
| Existing notification campaigns | ✅ Unchanged |
| Existing inbox / read APIs | ✅ Unchanged |
| Existing push payload keys | ✅ Preserved |

---

## 17. Testing Matrix

### APP

- [ ] Android login with `platform: app`, `device_type: android`
- [ ] iOS login with `platform: app`, `device_type: ios`
- [ ] Login without token
- [ ] FCM token stored in `device_tokens`
- [ ] Token refresh via `/profile/device-tokens`
- [ ] Logout deactivates token
- [ ] Foreground / background / terminated notification delivery

### Website

- [ ] Chrome login with `platform: web`, `device_type: browser`
- [ ] Safari login with `browser: safari`
- [ ] Login without token (permission denied)
- [ ] Web token stored
- [ ] Token refresh
- [ ] Logout deactivates token
- [ ] Foreground + background notification handling

### Backend

- [ ] Login without token
- [ ] Login with APP token
- [ ] Login with WEB token
- [ ] Same user, multiple devices (APP + WEB)
- [ ] Re-login updates `last_used_at`, no duplicates
- [ ] Empty `device_token` ignored
- [ ] Invalid OTP + token → auth fails, token not stored
- [ ] Campaign send to selected user
- [ ] Campaign send to all users
- [ ] Invalid FCM token → `is_active = false`
- [ ] Read/unread at user level

---

## 18. End-to-End Example

### Step 1 — APP login

```text
User A, Android, Token = APP_TOKEN_A
```

→ `device_tokens`: `{ user: A, token: APP_TOKEN_A, platform: android, channel: app }`

### Step 2 — Website login (same user)

```text
User A, Chrome, Token = WEB_TOKEN_A
```

→ `device_tokens`:
```text
User A → APP_TOKEN_A (android, active)
User A → WEB_TOKEN_A (web, active)
```

### Step 3 — Admin sends notification

```text
POST /admin/notifications/:id/send
target: User A
```

→ FCM sends to both `APP_TOKEN_A` and `WEB_TOKEN_A`

### Result

```text
Android APP  → receives push
Chrome site  → receives push
```

---

## 19. Implementation Reference

### Key files

| File | Role |
| ---- | ---- |
| `src/services/device-token.service.ts` | Store/deactivate tokens, platform mapping |
| `src/services/fcm.service.ts` | FCM send, invalid token cleanup |
| `src/services/notification.service.ts` | Campaign + transactional notifications |
| `src/queries/device.queries.ts` | SQL for device_tokens CRUD |
| `src/controllers/auth.controller.ts` | Login + logout token handling |
| `src/controllers/profile.controller.ts` | Device token register/remove |
| `src/validators/auth.schema.ts` | Login/logout validation |
| `src/validators/device.schema.ts` | Device token API validation |
| `src/database/migrations/001_add_device_tokens.sql` | Table creation |

### API summary

| Action | Endpoint |
| ------ | -------- |
| Login + register token | `POST /auth/verify-otp` |
| Refresh token | `POST /profile/device-tokens` |
| List tokens | `GET /profile/device-tokens` |
| Deactivate token | `DELETE /profile/device-tokens` or `POST /auth/logout` |
| Send notification (admin) | `POST /admin/notifications/:id/send` |
| User inbox | `GET /notifications` |

---

## 20. Final Rules

1. `device_token` is optional during login.
2. `platform` identifies delivery channel: `app` or `web`.
3. `device_type` holds detail: `android`, `ios`, or `browser`.
4. Tokens stored in `device_tokens` — not on the user row.
5. Multiple active devices per user are supported.
6. New device login does not overwrite other device tokens.
7. APP uses FCM mobile push; Website uses FCM Web Push.
8. Backend resolves tokens and routes via FCM.
9. Invalid tokens are deactivated automatically.
10. Token refresh updates via login or `/profile/device-tokens`.
11. Logout deactivates the relevant device token.
12. Read/unread is user-level (inbox), not device-level.
13. Login response structure is unchanged.
14. Notification permission must not block login.
15. Clients cannot register tokens for another user.
16. Device tokens are not exposed in API responses unnecessarily.
17. Production logs mask token values.
18. Backend is the source of truth for notification delivery.

---

## 21. Implementation Priority (Completed)

```text
✅ 1. Backend device token storage (device_tokens table)
✅ 2. Login API device_token + platform support
✅ 3. APP token registration (login + profile API)
✅ 4. Website token registration (login + profile API)
✅ 5. Token refresh handling (profile API)
✅ 6. Notification service platform-aware fan-out (FCM)
✅ 7. Individual-user notification (campaign selected)
✅ 8. All-user notification (campaign all)
✅ 9. Invalid token deactivation
⬜ 10. End-to-end APP + Website testing (client-side)
```
