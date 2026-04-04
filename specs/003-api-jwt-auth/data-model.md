# Data Model: API & JWT Auth (003)

## AccessToken (in-memory, not persisted)

**Type**: Pydantic model (JWT payload)
**Location**: `apps/api-service/src/api/lib/auth.py`

| Field | Python Type | Description |
|-------|-------------|-------------|
| sub | str | Operator UUID (subject) |
| role | str | "admin" or "viewer" |
| exp | int | Unix timestamp expiry |
| iat | int | Unix timestamp issued-at |

**Notes**: Never persisted. Created by `create_access_token()`, verified by `decode_access_token()`.

---

## RefreshToken (persisted in DB)

**Type**: SQLAlchemy ORM (see Feature 002 for full ORM model)
**Location**: `apps/api-service/src/api/db/models/refresh_token.py`

| Field | Python Type | Description |
|-------|-------------|-------------|
| id | UUID | Primary key |
| operator_id | UUID | FK → operators.id ON DELETE CASCADE |
| token_hash | str | SHA-256 hash of the opaque token value |
| expires_at | datetime | UTC expiry (default +30d from creation) |
| revoked_at | datetime \| None | Set on logout or rotation |
| created_at | datetime | Auto-set on insert |

**Notes**: The raw token value is never stored — only its SHA-256 hash. The raw token is returned once to the client in the httpOnly cookie.

---

## AuthConfig (YAML-backed Pydantic Settings)

**Type**: Pydantic v2 BaseSettings
**Location**: `config/schemas/api.py` + `config/runtime/api.yaml`

| Field | Python Type | Default | Description |
|-------|-------------|---------|-------------|
| access_token_ttl_minutes | int | 15 | Access token lifetime |
| refresh_token_ttl_days | int | 30 | Refresh token lifetime |
| cors_origins | list[str] | ["http://localhost:8050"] | Allowed CORS origins |
| rate_limit_login | str | "10/minute" | slowapi limit string |
| rate_limit_refresh | str | "30/minute" | slowapi limit string |

---

## API Route Contracts

### POST /auth/login

**Request**: `{ "username": str, "password": str }`
**Response 200**: `{ "access_token": str, "token_type": "bearer", "operator_id": str, "role": str }`
**Response 401**: `{ "detail": "Invalid credentials" }`
**Side effect**: Sets `refresh_token` httpOnly cookie

### POST /auth/refresh

**Request**: httpOnly cookie `refresh_token`
**Response 200**: `{ "access_token": str, "token_type": "bearer" }`
**Response 401**: `{ "detail": "Invalid or expired refresh token" }`
**Side effect**: Rotates refresh token cookie

### POST /auth/logout

**Request**: httpOnly cookie `refresh_token`
**Response 204**: No body
**Side effect**: Revokes refresh token, clears cookie

### GET /health

**Request**: None (no auth required)
**Response 200**: `{ "status": "healthy" | "degraded", "subsystems": { "database": str, "cache": str, "config": str } }`

### GET /auth/me

**Request**: Bearer access token
**Response 200**: `{ "operator_id": str, "username": str, "role": str }`
