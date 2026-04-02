# Contracts: API & Auth Interfaces

## Scope

These contracts define the externally consumed API behavior and internal invariants introduced by feature 003.

## 1) Authentication Routes

### `POST /auth/login`

Request body:

```json
{
  "email": "admin@finsight.local",
  "password": "<secret>"
}
```

Success response (`200`):
- `Set-Cookie: refreshToken=<token>; HttpOnly; SameSite` (and `Secure` in HTTPS/non-local environments)

```json
{
  "accessToken": "<jwt>",
  "user": {
    "id": "<user-id>",
    "email": "admin@finsight.local",
    "name": "Admin",
    "role": "admin",
    "telegramHandle": "@admin"
  }
}
```

Failure:
- `401` invalid credentials
- deterministic structured error body

### `POST /auth/refresh`

Request cookie:
- `refreshToken=<token>; HttpOnly; SameSite` (transported over HTTPS with `Secure` outside local dev)

Success (`200`):
- new access token returned

Failure:
- `401` for revoked/expired/invalid refresh token
- `503` when Redis-backed token state is unavailable (FR-019 fail-closed path)

### `POST /auth/logout`

Request cookie:
- `refreshToken=<token>; HttpOnly; SameSite` (transported over HTTPS with `Secure` outside local dev)

Success: `204 No Content`

Failure:
- `401` invalid token/session
- `503` when token-state persistence is unavailable

### `GET /auth/me`

Headers:
- `Authorization: Bearer <accessToken>`

Success (`200`): sanitized user profile

Failure:
- `401` missing/invalid/expired access token

## 2) Admin Routes

### `POST /admin/users`
- Admin-only
- Creates user with role and optional Telegram identity fields
- `201` on success, `403` for non-admin, conflict code for duplicate identity values

### `GET /admin/users`
- Admin-only
- Returns list of users without password hashes

### `PATCH /admin/users/:id`
- Admin-only
- Supports role and active-state updates

### `GET /admin/config`
- Admin-only
- Returns merged runtime configuration snapshot

### `POST /admin/config/reload`
- Admin-only
- Reloads config and returns changed top-level keys

## 3) Mission Control Status Route

### `GET /api/admin/status`

Contract invariants:
- stable schema suitable for 3-second polling
- includes all 9 agent slots whether active or idle
- includes spend, health, mission, KB, and queue sections
- bounded response window: must complete within 5 seconds (FR-015)
- degraded/partial payload permitted when dependencies are unavailable, with explicit health markers (FR-019)

## 4) Manual Trigger Routes

### `POST /api/watchdog/trigger`
### `POST /api/screener/trigger`

Contract invariants:
- admin-only
- enqueue work and return `202 Accepted`
- do not block on worker execution result

## 5) Middleware Invariants

- Request ID is generated per request and returned in `x-request-id`
- Structured logs always include requestId/method/path/status/duration
- Auth middleware populates authenticated principal context before protected handlers
- Role guard consistently returns `403` for insufficient role
- Rate limiter returns `429` on threshold breach and fails open with warning logs if Redis is unavailable
- Refresh token transport uses httpOnly cookie semantics (not JSON body)
