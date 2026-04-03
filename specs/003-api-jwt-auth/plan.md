# Implementation Plan: API & JWT Auth

**Branch**: `003-api-jwt-auth` | **Date**: 2026-04-02 | **Spec**: [spec.md](spec.md)

## Summary

Establish the FastAPI application instance with full JWT authentication (short-lived access token
+ httpOnly refresh token cookie), RBAC (admin/viewer via `require_role` dependency), rate-limited
auth endpoints via slowapi, CORS configuration, and a public `/health` endpoint. This plan also
establishes the shared middleware stack and router registration pattern for all subsequent features.

## Technical Context

**Language/Version**: Python 3.13
**Primary Dependencies**: fastapi, uvicorn[standard], python-jose[cryptography], passlib[bcrypt], slowapi, python-multipart
**Storage**: PostgreSQL 16 (Operator + RefreshToken tables from Feature 002)
**Testing**: pytest + pytest-asyncio + httpx.AsyncClient (offline)
**Target Platform**: Linux server (Docker) / Windows 11 dev (Podman)
**Project Type**: FastAPI web service (apps/api)
**Performance Goals**: Login response < 2 s; health endpoint < 200 ms
**Constraints**: mypy --strict zero errors; ruff zero warnings; all tests offline; no real server
**Scale/Scope**: Single-tenant personal tool; 2 roles; ~5 auth endpoints

## Constitution Check

- [x] Everything-as-Code — token TTLs, CORS origins, rate limits in config/runtime/api.yaml
- [x] Agent Boundaries — N/A (auth layer has no agent logic)
- [x] MCP Server Independence — N/A
- [x] Cost Observability — N/A (no LLM calls)
- [x] Fail-Safe Defaults — sys.exit(1) on invalid api.yaml; 401/403 on bad tokens
- [x] Test-First — all routes tested with httpx.AsyncClient offline
- [x] Simplicity Over Cleverness — one require_role() dependency; no RBAC framework

## Project Structure

### Source Code

```text
apps/api/src/api/
├── main.py                  # FastAPI app, middleware, router registration
├── routes/
│   ├── __init__.py
│   ├── auth.py              # /auth/login, /auth/refresh, /auth/logout, /auth/me
│   └── health.py            # /health
└── lib/
    └── auth.py              # JWT create/verify, password hash, require_role dep

config/runtime/
└── api.yaml                 # CORS origins, token TTLs, rate limits

config/schemas/
└── api.py                   # Pydantic v2 schema for api.yaml

apps/api/tests/routes/
├── conftest.py              # httpx.AsyncClient fixture, mock Operator
├── test_auth.py             # login, refresh, logout, me, rate limiting
└── test_health.py           # health endpoint
```

## Implementation Phases

### Phase 1: Config Schema

**Files**: `config/runtime/api.yaml`, `config/schemas/api.py`

**Key decisions**:
- `access_token_ttl_minutes: 15`, `refresh_token_ttl_days: 30` (configurable defaults)
- `cors_origins: ["http://localhost:8050"]` (Dash dashboard default)
- `rate_limit_login: "10/minute"`, `rate_limit_refresh: "30/minute"`

### Phase 2: Auth Library

**Files**: `apps/api/src/api/lib/auth.py`

**Key decisions**:
- `create_access_token(operator_id, role)` → signed JWT (HS256)
- `decode_access_token(token)` → `TokenPayload` Pydantic model or raises `HTTPException(401)`
- `hash_password(plain)` + `verify_password(plain, hashed)` via passlib bcrypt
- `require_role(role)` returns `Depends(...)` callable; reads JWT from `Authorization: Bearer`
- `get_current_operator()` dependency (no role restriction)

### Phase 3: Auth Routes

**Files**: `apps/api/src/api/routes/auth.py`

**Key decisions**:
- `POST /auth/login`: verify credentials via OperatorRepository → issue access token + set refresh cookie
- `POST /auth/refresh`: read refresh cookie → verify against DB → rotate → issue new access token
- `POST /auth/logout`: revoke refresh token in DB, clear cookie (204)
- `GET /auth/me`: `Depends(get_current_operator)` → return operator fields
- slowapi `@limiter.limit("10/minute")` on login, `@limiter.limit("30/minute")` on refresh

### Phase 4: Health Route

**Files**: `apps/api/src/api/routes/health.py`

**Key decisions**:
- No auth required
- Checks DB connectivity (`SELECT 1`) and Redis PING
- Returns `{"status": "healthy"|"degraded", "subsystems": {...}}`

### Phase 5: App Instance + Middleware

**Files**: `apps/api/src/api/main.py`

**Key decisions**:
- `CORSMiddleware(allow_origins=settings.cors_origins, allow_credentials=True)`
- `SlowAPIMiddleware` from slowapi
- Router registration: `app.include_router(auth_router, prefix="/auth")`, `app.include_router(health_router)`
- Startup event: validate config, confirm DB connection

### Phase 6: Tests

**Files**: `apps/api/tests/routes/conftest.py`, `test_auth.py`, `test_health.py`

**Key decisions**:
- `httpx.AsyncClient(app=app, base_url="http://test")` — no real server
- Mock `OperatorRepository` with `AsyncMock`
- Test: successful login, wrong password, expired token, viewer calling admin route, rate limit

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Token storage | Access in response body; refresh in httpOnly cookie | Constitution requirement |
| Refresh token | DB-backed single-use rotation | Enables revocation; prevents theft |
| Rate limiting | slowapi + Redis | FastAPI-native; same Redis instance |
| Admin protection | require_role("admin") dependency | Reusable, composable, zero boilerplate |
| Bootstrap | Seed script creates first admin | No public registration endpoint |

## Testing Strategy

- Login success: mock operator in DB → verify access token in response + cookie set
- Login failure: wrong password → 401; missing user → 401
- Token refresh: valid cookie → new token + rotated cookie; expired cookie → 401
- RBAC: viewer token → 403 on admin route; admin token → 200
- Rate limit: >10 requests/min to /auth/login → 429
- Health: mock DB healthy → 200; mock DB error → 200 with degraded status

## Dependencies

- **Requires**: 002-async-data-layer (Operator + RefreshToken repos)
- **Required by**: 004 through 011 (all API routes use auth)

> **Cross-feature note (S3 — Service JWT for Telegram bot)**: Feature 009 (Telegram Bot) calls the
> internal API from a separate process using a machine-to-machine service credential. This is
> implemented as follows:
>
> - A long-lived JWT is signed with `SECRET_KEY`, carrying `sub="service:telegram-bot"` and
>   `role="service"`. It has no expiry (or a very long one — configurable in `api.yaml` as
>   `service_token_ttl_days`, default 3650).
> - `require_role()` in `apps/api/src/api/lib/auth.py` is extended to accept the `service` role
>   for endpoints that the bot calls (specifically `GET /operators?telegram_user_id=...` and
>   `PATCH /operators/{id}` to store `telegram_chat_id`).
> - The token is **pre-generated once** by the seed script (Feature 011) using
>   `create_access_token(sub="service:telegram-bot", role="service")` and written to the operator's
>   `.env` as `TELEGRAM_SERVICE_TOKEN`. It is never stored in the database.
> - No new endpoint is needed — the token is a one-time artefact, not a rotating credential.
>
> **Implementation tasks for this feature**: Add `service_token_ttl_days: int` to `ApiConfig` and
> extend `require_role("service")` in `lib/auth.py`. Feature 011 generates the token value.

> **Cross-feature note (S3)**: Feature 001 establishes `load_all_configs()` in
> `apps/api/src/api/lib/config.py` which loads exactly 5 YAML files at startup. This feature
> introduces a 6th YAML file (`api.yaml`). As part of **Phase 1**, extend `load_all_configs()`
> to also load and validate `config/runtime/api.yaml` using `ApiConfig`. The `AllConfigs`
> dataclass gains an `api: ApiConfig` field. All callers that need auth/CORS settings access
> them via `configs.api`. This ensures `sys.exit(1)` on invalid `api.yaml` is enforced at the
> same startup gate as all other config files.
