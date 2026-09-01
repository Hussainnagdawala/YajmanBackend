# Login API – Device Token Integration

> **See also:** [NOTIFICATION_DEVICE_TOKEN_PLATFORM_FLOW.md](./NOTIFICATION_DEVICE_TOKEN_PLATFORM_FLOW.md) for the complete multi-device, APP + Website notification architecture.

This document describes the **device push token** integration added to the Yajman backend login flow. It is a **backward-compatible** extension: existing clients that do not send `device_token` continue to work exactly as before.

**Base URL:** `http://localhost:{PORT}/api/v1` (see `.env` for `PORT`)

---

## Overview

| Item | Detail |
| ---- | ------ |
| **Login endpoint** | `POST /auth/verify-otp` |
| **Auth method** | Phone + OTP (not email/password) |
| **New request fields** | `device_token` (optional), `platform` (optional) |
| **Login response** | **Unchanged** |
| **Storage** | Existing `device_tokens` table (multi-device per user) |
| **Related endpoint** | `POST /profile/device-tokens` (still available for token refresh) |

---

## Objective

Allow the mobile app to send the device's FCM/APNs push notification token during login so the backend can deliver push notifications later via the existing notification flow.

```
User Login (verify-otp)
        ↓
Authenticate user
        ↓
If device_token provided → store/update token
        ↓
Return existing login response (unchanged)
```

---

## Login Flow

Yajman uses a **two-step OTP login**:

### Step 1 – Send OTP

```http
POST /api/v1/auth/send-otp
Content-Type: application/json
```

```json
{
  "phone": "9876543210",
  "country_code": "+91"
}
```

**Response:**

```json
{
  "success": true,
  "message": "OTP sent",
  "data": {
    "expires_in": 600
  }
}
```

### Step 2 – Verify OTP (Login)

```http
POST /api/v1/auth/verify-otp
Content-Type: application/json
```

#### Request fields

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `phone` | string | **Yes** | 10-digit Indian mobile number (`^[6-9]\d{9}$`) |
| `otp` | string | **Yes** | 6-digit OTP received via SMS/WhatsApp |
| `country_code` | string | No | Default: `"+91"` |
| `device_source` | string | No | `web` \| `app` \| `portal`. Default: `web`. Analytics/session label only |
| `device_token` | string | No | FCM/APNs/Web Push token. Stored **after** successful authentication |
| `platform` | string | No | `web` \| `android` \| `ios`. See [Platform resolution](#platform-resolution) |

#### Example – login with device token (Android)

```json
{
  "phone": "9876543210",
  "otp": "123456",
  "country_code": "+91",
  "device_source": "app",
  "device_token": "fcm-device-token-here",
  "platform": "android"
}
```

#### Example – login without device token (unchanged)

```json
{
  "phone": "9876543210",
  "otp": "123456"
}
```

#### Success response (unchanged)

```json
{
  "success": true,
  "message": "Success",
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
    "is_new_user": false
  }
}
```

> **Important:** The response structure is **not modified** by this feature. No `device_token` is returned in the response.

---

## Device Token Handling

### Storage model

Tokens are stored in the existing `device_tokens` table (migration `001_add_device_tokens.sql`):

| Column | Description |
| ------ | ----------- |
| `user_id` | Authenticated user the token belongs to |
| `token` | Push token string (**UNIQUE** across all users) |
| `platform` | `web` \| `android` \| `ios` |
| `device_info` | Optional JSON metadata (e.g. `{ "device_source": "app" }`) |
| `is_active` | Whether the token is active |
| `last_used_at` | Updated on each upsert |

**Multi-device support:** A user may have multiple active tokens (e.g. phone + tablet). Each physical device install has one unique token.

**Token reassignment:** If the same token is registered by a different user (shared device, logout/login), the token is reassigned to the new user via `ON CONFLICT (token) DO UPDATE`.

### When the token is stored

```
POST /auth/verify-otp
        │
        ├─ OTP invalid ──────────────► 400 error (token NOT stored)
        │
        └─ OTP valid
                │
                ├─ Find or create user
                │
                ├─ device_token missing or empty?
                │       └─ Yes → skip token storage
                │
                ├─ device_token present?
                │       └─ Yes → upsert into device_tokens
                │
                └─ Return existing login response
```

Token storage happens **only after** successful OTP verification and user resolution. Invalid credentials never associate a token with a user.

### Empty / missing token behavior

| Input | Behavior |
| ----- | -------- |
| `device_token` omitted | Normal login; no token change |
| `device_token: ""` | Treated as missing; existing token **not** overwritten |
| `device_token: "   "` | Trimmed to empty; treated as missing |
| Valid non-empty token | Upserted for the authenticated user |

### Token update (same or new device)

```
Previous login:  device_token = TOKEN_A
New login:       device_token = TOKEN_B

Result: TOKEN_B stored (TOKEN_A remains if still active on another device)
```

If the same token is sent again on login, `last_used_at` is refreshed and `is_active` is set to `true`.

### Platform resolution

| `platform` sent | `device_source` | Resolved platform |
| --------------- | --------------- | ----------------- |
| `android` | any | `android` |
| `ios` | any | `ios` |
| `web` | any | `web` |
| omitted | `app` | `android` (default) |
| omitted | `web` or `portal` | `web` |

> **iOS apps must send `"platform": "ios"` explicitly.** The default for `device_source: "app"` is `android`.

### Storage failure does not block login

If the database upsert fails, the error is logged (with a **masked** token) and login still succeeds. Push delivery may fail until the token is re-registered.

---

## Token Refresh (Without Re-login)

The existing profile endpoint remains available and is the recommended way to update a token when FCM rotates it **while the user is already logged in**:

```http
POST /api/v1/profile/device-tokens
Authorization: Bearer <access_token>
Content-Type: application/json
```

```json
{
  "token": "new-fcm-token",
  "platform": "android",
  "device_info": { "model": "Pixel 8" }
}
```

**When to use each:**

| Scenario | Endpoint |
| -------- | -------- |
| User logging in | `POST /auth/verify-otp` with `device_token` |
| Token refreshed while logged in | `POST /profile/device-tokens` |
| User logs out | `DELETE /profile/device-tokens` with `{ "token": "..." }` |

---

## Mobile App Integration

### Recommended flow

```
Login Screen
    ↓
User enters phone + OTP
    ↓
Get FCM token (Firebase Messaging)
    ↓
POST /auth/verify-otp
    {
      phone, otp, country_code,
      device_source: "app",
      device_token: <FCM token>,
      platform: "android" | "ios"
    }
    ↓
Backend authenticates + stores token
    ↓
Use access_token / refresh_token as before
```

### Flutter example (conceptual)

```dart
// 1. Get FCM token (use your existing notification service if present)
final deviceToken = await FirebaseMessaging.instance.getToken();

// 2. Login with optional device_token
final response = await http.post(
  Uri.parse('$baseUrl/auth/verify-otp'),
  headers: {'Content-Type': 'application/json'},
  body: jsonEncode({
    'phone': phone,
    'otp': otp,
    'country_code': '+91',
    'device_source': 'app',
    if (deviceToken != null) 'device_token': deviceToken,
    'platform': Platform.isIOS ? 'ios' : 'android',
  }),
);
```

### Token refresh listener

If Firebase Messaging is already integrated, listen for token refresh and call the profile endpoint:

```dart
FirebaseMessaging.instance.onTokenRefresh.listen((newToken) async {
  // User must be logged in (have access_token)
  await registerDeviceToken(newToken);
});
```

If the user is not logged in when the token refreshes, the next login via `verify-otp` will send the latest token.

### Missing token is OK

If FCM token is unavailable (permissions denied, simulator, network error), **still call login** without `device_token`. Login must not be blocked.

---

## Security

| Rule | Implementation |
| ---- | -------------- |
| Do not log full tokens | Logs use masked format: `abcd...xyz` |
| Do not return token in login response | Response unchanged |
| Do not store on failed auth | Token stored only after OTP passes |
| Treat as sensitive | Same handling as existing `/profile/device-tokens` |

---

## Notification Flow (Downstream)

This feature only **registers** the token. Sending notifications uses the existing pipeline:

```
Admin / system sends notification
        ↓
Resolve target user(s)
        ↓
Query device_tokens WHERE user_id = ? AND is_active = true
        ↓
Send via FCM (firebase-admin)
```

No changes were made to `/notifyUser` or campaign send logic as part of this task.

---

## Edge Cases & Expected Behavior

| Test case | Expected result |
| --------- | --------------- |
| Login with phone + OTP + `device_token` | Login success; token stored |
| Login with phone + OTP only | Login success; no token change |
| Login with `device_token: ""` | Login success; existing token preserved |
| Login with new `device_token` | Login success; new token stored/updated |
| Wrong OTP + `device_token` | 400 auth error; token **not** stored |
| Token storage DB error | Login still succeeds; error logged |
| Same device, different user logs in | Token reassigned to new user |
| iOS app without `platform` | Defaults to `android` — **send `platform: "ios"`** |

---

## Regression Checklist

After deploying, verify:

- [ ] `POST /auth/send-otp` still works
- [ ] `POST /auth/verify-otp` without `device_token` still works
- [ ] `POST /auth/verify-otp` with `device_token` stores token in `device_tokens`
- [ ] `POST /auth/refresh-token` unchanged
- [ ] `POST /auth/logout` unchanged
- [ ] `POST /profile/device-tokens` still works for token refresh
- [ ] `DELETE /profile/device-tokens` still works on logout
- [ ] New user signup (first OTP login) works with and without `device_token`
- [ ] Push notification campaigns can resolve tokens for target users

---

## Backend Implementation Reference

### Files changed

| File | Change |
| ---- | ------ |
| `src/validators/auth.schema.ts` | Optional `device_token` and `platform` on `verifyOtpSchema` |
| `src/controllers/auth.controller.ts` | Call `storeDeviceTokenForUser` after successful auth |
| `src/services/device-token.service.ts` | **New** — upsert logic, platform resolution, masked logging |
| `src/routes/auth.routes.ts` | Swagger/OpenAPI docs updated |
| `API_DOCUMENTATION.md` | Request field table updated |

### Files **not** changed

- Login response shape
- JWT / refresh token generation
- OTP validation logic
- User roles / permissions
- `POST /profile/device-tokens` behavior
- Notification send pipeline

### Core service

```typescript
// src/services/device-token.service.ts
storeDeviceTokenForUser(userId, {
  deviceToken,   // optional; empty/missing → no-op
  platform,      // optional; inferred from device_source
  deviceSource,  // web | app | portal
});
```

Uses the existing SQL upsert in `src/queries/device.queries.ts`:

```sql
INSERT INTO device_tokens (user_id, token, platform, device_info, is_active, last_used_at)
VALUES ($1, $2, $3, $4, true, NOW())
ON CONFLICT (token) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  platform = EXCLUDED.platform,
  device_info = EXCLUDED.device_info,
  is_active = true,
  last_used_at = NOW()
```

---

## Quick Reference

```
                    POST /auth/verify-otp
                              │
              ┌───────────────┴───────────────┐
              │                               │
     device_token provided            No device_token
              │                               │
              ▼                               ▼
     Authenticate user (OTP)         Authenticate user (OTP)
              │                               │
              ▼                               │
     Store/update device token                │
              │                               │
              └───────────────┬───────────────┘
                              ▼
                   Existing login response
              (access_token, refresh_token, user, is_new_user)
```

---

## Related Documentation

- [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) — full API reference (`/auth/verify-otp`, `/profile/device-tokens`)
- [README.md](./README.md) — setup, environment, Firebase/FCM configuration
