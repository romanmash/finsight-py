# Tasks: API & JWT Auth

**Input**: Design documents from `/specs/003-api-jwt-auth/`
**Prerequisites**: plan.md ✅ | spec.md ✅ | data-model.md ✅ | research.md ✅ | quickstart.md ✅
**Total Tasks**: 26

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no blocking dependencies)
- **[Story]**: Which user story this task belongs to ([US1]–[US5])
- Exact file paths are included in every description

---

## Phase 1: Setup (Package & Config Structure)

**Purpose**: Create all directory structure, add dependencies, and extend Feature 001's config
infrastructure with the new `api.yaml` YAML + schema. No auth logic yet — scaffolding only.

- [ ] T001 Add `python-jose[cryptography]`, `passlib[bcrypt]`, `slowapi`, `python-multipart`, `httpx` to `apps/api/pyproject.toml` dependencies in `apps/api/pyproject.toml`
- [ ] T002 [P] Create `apps/api/src/api/routes/__init__.py` (empty) and `apps/api/src/api/routes/auth.py` (empty module with `router = APIRouter()`), `apps/api/src/api/routes/health.py` (empty module with `router = APIRouter()`), and `apps/api/src/api/routes/operators.py` (empty module with `router = APIRouter()`) in `apps/api/src/api/routes/`
- [ ] T003 [P] Create `apps/api/tests/routes/__init__.py` (empty) in `apps/api/tests/routes/__init__.py`

**Checkpoint**: `uv sync` completes; new dependencies installed; route module stubs importable.

---

## Phase 2: Foundational (Config + Auth Library + App Instance)

**Purpose**: `api.yaml` schema, the `lib/auth.py` JWT/password library, and `main.py` FastAPI app
instance with middleware must all exist before any route can be implemented or tested.

**⚠️ CRITICAL**: All user stories depend on this phase being complete.

- [ ] T004 Create `config/runtime/api.yaml` with defaults: `access_token_ttl_minutes: 15`, `refresh_token_ttl_days: 30`, `service_token_ttl_days: 3650`, `cors_origins: ["http://localhost:8050"]`, `rate_limit_login: "10/minute"`, `rate_limit_refresh: "30/minute"` in `config/runtime/api.yaml`
- [ ] T005 Create `config/schemas/api.py` with `ApiConfig(BaseModel)`: `access_token_ttl_minutes: int`, `refresh_token_ttl_days: int`, `service_token_ttl_days: int = 3650`, `cors_origins: list[str]`, `rate_limit_login: str`, `rate_limit_refresh: str` — `model_config = ConfigDict(frozen=True)` in `config/schemas/api.py`
- [ ] T006 Extend `apps/api/src/api/lib/config.py` to:
  - Add `from config.schemas.api import ApiConfig` import
  - Add `api: ApiConfig` field to `AllConfigs` dataclass
  - Add `load_yaml_config(config_dir / "api.yaml", ApiConfig)` call inside `load_all_configs()` (now loads 6 YAML files total)
  in `apps/api/src/api/lib/config.py`
- [ ] T007 Create `apps/api/src/api/lib/auth.py` with:
  - `TokenPayload(BaseModel)`: `sub: str`, `role: str`, `exp: int`, `iat: int`
  - `create_access_token(sub: str, role: str, ttl_minutes: int) -> str` — HS256-signed JWT using `SECRET_KEY` from settings
  - `decode_access_token(token: str) -> TokenPayload` — raises `HTTPException(401)` on invalid/expired token
  - `hash_password(plain: str) -> str` — passlib bcrypt
  - `verify_password(plain: str, hashed: str) -> bool` — passlib bcrypt
  - `get_current_operator(token: str = Depends(oauth2_scheme)) -> TokenPayload` — decodes token; raises 401 if invalid
  - `require_role(*roles: str) -> Callable` — returns a FastAPI `Depends(...)` callable that calls `get_current_operator` and verifies `payload.role in roles`; raises `HTTPException(403)` on role mismatch; accepts `"admin"`, `"viewer"`, `"service"`
  in `apps/api/src/api/lib/auth.py`
- [ ] T008 Create `apps/api/src/api/main.py` with:
  - FastAPI app instance with lifespan that calls `load_all_configs()` and `configure_logging()` at startup
  - `CORSMiddleware(allow_origins=configs.api.cors_origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])`
  - `SlowAPIMiddleware` from slowapi; `limiter = Limiter(key_func=get_remote_address)` attached to app state
  - `app.include_router(auth_router, prefix="/auth", tags=["auth"])`
  - `app.include_router(health_router, tags=["health"])`
  - `app.include_router(operators_router, prefix="/operators", tags=["operators"])`
  in `apps/api/src/api/main.py`
- [ ] T009 Create `apps/api/tests/routes/conftest.py` with:
  - `app_client` async fixture: `httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test")`
  - `mock_operator_repo` fixture: `AsyncMock` of `OperatorRepository` with a preset admin operator and a viewer operator
  - `admin_token` fixture: calls `create_access_token(sub=str(admin_op.id), role="admin", ttl_minutes=15)`
  - `viewer_token` fixture: calls `create_access_token(sub=str(viewer_op.id), role="viewer", ttl_minutes=15)`
  - `expired_token` fixture: calls `create_access_token` with `ttl_minutes=-1`
  - `mock_configs` fixture: patches `load_all_configs` to return test `AllConfigs` with api config
  in `apps/api/tests/routes/conftest.py`

**Checkpoint**: `from api.lib.auth import require_role` works; `from api.main import app` works; mypy passes on lib/auth.py.

---

## Phase 3: User Story 1 — Operator Logs In and Receives Secure Credentials (Priority: P1) 🎯 MVP

**Goal**: `POST /auth/login` issues access token + httpOnly refresh cookie; `GET /auth/me` returns
operator identity; both fully tested offline with `httpx.AsyncClient`.

**Independent Test**: `uv run pytest apps/api/tests/routes/test_auth.py::test_login_success apps/api/tests/routes/test_auth.py::test_me` — pass.

- [ ] T010 [US1] Implement `POST /auth/login` in `apps/api/src/api/routes/auth.py`:
  - Accept `OAuth2PasswordRequestForm` (username=email, password)
  - Call `OperatorRepository.get_by_email()` → if not found or `verify_password` fails → `HTTPException(401, "Invalid credentials")`
  - If `operator.is_active` is False → `HTTPException(401, "Account disabled")`
  - Create raw refresh token (`secrets.token_hex(32)`), hash it (SHA-256), store `RefreshTokenORM` via `RefreshTokenRepository.create()`
  - Call `create_access_token(sub=str(op.id), role=op.role, ttl_minutes=configs.api.access_token_ttl_minutes)`
  - Return `{"access_token": ..., "token_type": "bearer", "operator_id": ..., "role": ...}` and set httpOnly cookie `refresh_token=<raw_token>; SameSite=Strict; HttpOnly; Path=/auth`
  - Apply `@limiter.limit(configs.api.rate_limit_login)` decorator
  in `apps/api/src/api/routes/auth.py`
- [ ] T011 [US1] Implement `GET /auth/me` in `apps/api/src/api/routes/auth.py`:
  - `Depends(get_current_operator)` → `payload: TokenPayload`
  - Return `{"operator_id": payload.sub, "role": payload.role}`
  in `apps/api/src/api/routes/auth.py`
- [ ] T012 [US1] Implement `POST /auth/logout` in `apps/api/src/api/routes/auth.py`:
  - Read `refresh_token` cookie → hash it → `RefreshTokenRepository.revoke()` if found
  - Delete the `refresh_token` cookie from response
  - Return HTTP 204 No Content
  in `apps/api/src/api/routes/auth.py`
- [ ] T013 [US1] Write `apps/api/tests/routes/test_auth.py` — US1 tests:
  - `test_login_success` — mock OperatorRepo returns admin op, verify_password returns True → 200 + access_token + cookie set
  - `test_login_wrong_password` — verify_password returns False → 401
  - `test_login_unknown_user` — get_by_email returns None → 401
  - `test_login_inactive_account` — is_active=False → 401
  - `test_me_with_valid_token` — valid admin token → 200 with operator_id and role
  - `test_me_with_no_token` → 401
  in `apps/api/tests/routes/test_auth.py`

**Checkpoint**: `uv run pytest apps/api/tests/routes/test_auth.py -k "login or me"` — all pass offline.

---

## Phase 4: User Story 2 — Access Token Refreshes Without Re-Login (Priority: P1)

**Goal**: `POST /auth/refresh` reads httpOnly cookie, validates DB record, rotates token, issues
new access token. Expired/revoked refresh tokens rejected with 401.

**Independent Test**: `uv run pytest apps/api/tests/routes/test_auth.py -k "refresh"` — all pass.

- [ ] T014 [US2] Implement `POST /auth/refresh` in `apps/api/src/api/routes/auth.py`:
  - Read `refresh_token` cookie (missing cookie → `HTTPException(401)`)
  - Hash the raw token (SHA-256) → `RefreshTokenRepository.get_by_hash()` → None or `revoked_at` set or `expires_at` past → `HTTPException(401, "Invalid or expired refresh token")`
  - Look up operator by `refresh_token.operator_id` → if `is_active` False → 401
  - Rotate: revoke old refresh token, create new one, set new cookie
  - Issue new access token → return `{"access_token": ..., "token_type": "bearer"}`
  - Apply `@limiter.limit(configs.api.rate_limit_refresh)` decorator
  in `apps/api/src/api/routes/auth.py`
- [ ] T015 [US2] Add US2 tests to `apps/api/tests/routes/test_auth.py`:
  - `test_refresh_valid_cookie` — mock RefreshTokenRepo returns valid record → 200 + new access_token + rotated cookie
  - `test_refresh_no_cookie` → 401
  - `test_refresh_revoked_token` — `revoked_at` is set → 401
  - `test_refresh_expired_token` — `expires_at` is in past → 401
  - `test_expired_access_token_on_protected_endpoint` — expired token on `GET /auth/me` → 401
  in `apps/api/tests/routes/test_auth.py`

**Checkpoint**: `uv run pytest apps/api/tests/routes/test_auth.py -k "refresh or expired"` — all pass offline.

---

## Phase 5: User Story 3 — Admin Routes Are Inaccessible to Viewer-Role Operators (Priority: P1)

**Goal**: `require_role("admin")` dependency correctly rejects viewer tokens (403) and accepts
admin tokens (200). `require_role("service")` accepts service-role tokens. A dedicated test-only
admin route verifies the pattern.

**Independent Test**: `uv run pytest apps/api/tests/routes/test_auth.py -k "rbac or role or admin or service"` — all pass.

- [ ] T016 [US3] Add a test-only admin endpoint to `apps/api/src/api/routes/auth.py` (decorated with `include_in_schema=False`):
  - `GET /auth/admin-only` — `Depends(require_role("admin"))` → returns `{"ok": True}`
  - This endpoint exists solely to test RBAC; it will be removed or replaced once Feature 004+ adds real admin routes
  in `apps/api/src/api/routes/auth.py`
- [ ] T017 [US3] Add US3 tests to `apps/api/tests/routes/test_auth.py`:
  - `test_admin_route_with_admin_token` — admin token on `/auth/admin-only` → 200
  - `test_admin_route_with_viewer_token` — viewer token → 403 (not 401)
  - `test_admin_route_with_no_token` → 401 (distinguish from 403)
  - `test_service_token_accepted_on_service_route` — generate token with `role="service"` → `require_role("service")` → 200
  - `test_service_token_rejected_on_admin_route` — service token on `require_role("admin")` → 403
  in `apps/api/tests/routes/test_auth.py`

**Checkpoint**: `uv run pytest apps/api/tests/routes/test_auth.py -k "admin or role or service"` — all pass offline.

---

## Phase 6: User Story 4 — System Health Is Visible Without Authentication (Priority: P2)

**Goal**: `GET /health` returns structured subsystem status; no auth required; DB unreachable
returns degraded status without raising an unhandled exception.

**Independent Test**: `uv run pytest apps/api/tests/routes/test_health.py` — all pass offline.

- [ ] T018 [US4] Implement `GET /health` in `apps/api/src/api/routes/health.py`:
  - No `Depends(get_current_operator)` — fully public
  - Check DB: run `SELECT 1` via `get_session()`; catch any `SQLAlchemyError` → status = "error"
  - Check Redis: `CacheClient.get("health_probe")` or `ping()`; catch any exception → status = "error"
  - Check config: `load_all_configs()` already ran at startup; report "ok" if app is running (no re-validation needed)
  - Return: `{"status": "healthy" if all ok else "degraded", "subsystems": {"database": "ok"|"error", "cache": "ok"|"error", "config": "ok"}}`
  - Response time target: < 200 ms
  in `apps/api/src/api/routes/health.py`
- [ ] T019 [P] [US4] Write `apps/api/tests/routes/test_health.py`:
  - `test_health_all_ok` — mock DB and Redis healthy → 200 `{"status": "healthy", ...}`
  - `test_health_db_down` — mock DB raises `SQLAlchemyError` → 200 `{"status": "degraded", "subsystems": {"database": "error", ...}}`
  - `test_health_no_auth_required` — no Authorization header → 200 (not 401)
  in `apps/api/tests/routes/test_health.py`

**Checkpoint**: `uv run pytest apps/api/tests/routes/test_health.py` — all pass offline.

---

## Phase 7: User Story 5 — Repeated Failed Login Attempts Are Rate-Limited (Priority: P2)

**Goal**: slowapi rate limiting on `POST /auth/login` (10/minute) and `POST /auth/refresh`
(30/minute) returns HTTP 429 when limits are exceeded.

**Independent Test**: `uv run pytest apps/api/tests/routes/test_auth.py -k "rate_limit"` — pass.

- [ ] T020 [US5] Add US5 tests to `apps/api/tests/routes/test_auth.py`:
  - `test_login_rate_limit` — send 11 POST /auth/login requests from the same mock client IP; assert the 11th returns 429 with a `Retry-After` header (use `slowapi` test utilities or patch limiter storage)
  - `test_refresh_rate_limit` — send 31 POST /auth/refresh requests; assert 31st returns 429
  - Note: use `limits.storage.MemoryStorage()` for the limiter in tests to avoid Redis dependency
  in `apps/api/tests/routes/test_auth.py`
- [ ] T021 [US5] Verify slowapi `Limiter` in `apps/api/src/api/main.py` is initialised with `storage_uri="memory://"` when `ENVIRONMENT=test` (or always in unit tests via fixture override); document the test pattern in a comment in `apps/api/src/api/main.py`

**Checkpoint**: `uv run pytest apps/api/tests/routes/test_auth.py -k "rate"` — pass offline.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Wire up service JWT docs, final quality gate, and ensure `main.py` startup validation works end-to-end.

- [ ] T022 [P] Add `TELEGRAM_SERVICE_TOKEN=` placeholder and documentation comment to `.env.example` explaining it is generated by Feature 011's seed script and printed to stdout for manual addition in `.env.example`
- [ ] T023 [P] Update `apps/api/tests/test_config.py` to add a test verifying `load_all_configs()` now loads 6 YAML files (including `api.yaml`) and `AllConfigs` has an `api` attribute of type `ApiConfig` in `apps/api/tests/test_config.py`
- [ ] T024 [P] Implement service-role operator lookup/update endpoints in `apps/api/src/api/routes/operators.py`:
  - `GET /operators` with required query param `telegram_user_id: int`; `Depends(require_role("service", "admin"))`; calls `OperatorRepository.get_by_telegram_user_id()`; returns Operator JSON on hit, 404 on miss
  - `PATCH /operators/{operator_id}` with payload `{"telegram_chat_id": int}`; `Depends(require_role("service", "admin"))`; updates operator chat id via repository; returns updated Operator JSON; 404 on unknown operator
  - Ensure both endpoints return structured error payloads on validation/auth failures
  in `apps/api/src/api/routes/operators.py`
- [ ] T025 [P] Add `apps/api/tests/routes/test_operators.py`:
  - `test_get_operator_by_telegram_user_id_service_token_success` — service token + known telegram ID → 200 with operator payload
  - `test_get_operator_by_telegram_user_id_not_found` — service token + unknown ID → 404
  - `test_patch_operator_telegram_chat_id_service_token_success` — service token + valid operator_id + payload → 200 and updated `telegram_chat_id`
  - `test_patch_operator_telegram_chat_id_unauthenticated` — no token → 401
  - `test_patch_operator_telegram_chat_id_viewer_forbidden` — viewer token → 403
  in `apps/api/tests/routes/test_operators.py`
- [ ] T026 Run full quality gate: `uv run pytest apps/api/tests/routes/ apps/api/tests/test_config.py` (all offline, all pass) + `uv run mypy --strict apps/api/src/api/` (zero errors) + `uv run ruff check` (zero warnings) — fix any remaining issues

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1; T004→T005→T006 sequential (schema before config extension); T007 (auth lib) after T005; T008 (main.py) after T007; T009 (test conftest) after T007+T008
- **US1 (Phase 3)**: Depends on all of Phase 2; T010–T012 can run in parallel (all in routes/auth.py); T013 after T010–T012
- **US2 (Phase 4)**: Depends on T010 (login creates refresh tokens); T014–T015 sequential
- **US3 (Phase 5)**: Depends on T007 (`require_role` implementation); T016–T017 sequential
- **US4 (Phase 6)**: Depends on T008 (main.py has router registration); T018→T019 sequential
- **US5 (Phase 7)**: Depends on T008 (limiter in main.py) and T010 (login endpoint); T020→T021 sequential
- **Polish (Phase 8)**: Depends on all phases complete; T024/T025 can run in parallel after T007/T008, and T026 runs last

### User Story Dependencies

- **US1 (P1)**: Core login flow — all other stories build on this
- **US2 (P1)**: Depends on US1 (login creates the refresh tokens that refresh rotates)
- **US3 (P1)**: Independent of US1/US2 — only needs `require_role()` from lib/auth.py
- **US4 (P2)**: Independent of US1/US2/US3 — health route has no auth dependency
- **US5 (P2)**: Depends on US1 (tests login endpoint) and foundational limiter setup

### Parallel Execution Map

```
Phase 1: T001 → [T002, T003] in parallel
Phase 2: T004 → T005 → T006; T007 parallel with T006; T008 after T007; T009 after T008
Phase 3: [T010, T011, T012] in parallel → T013
Phase 4: T014 → T015
Phase 5: T016 → T017
Phase 6: T018 → T019
Phase 7: T020 → T021
Phase 8: [T022, T023, T024, T025] in parallel → T026
```

---

## Parallel Example: Phase 3 (Auth Routes)

```
# All three route handlers are in the same file but independent sections:
Task T010: POST /auth/login implementation
Task T011: GET /auth/me implementation
Task T012: POST /auth/logout implementation
# → then Task T013: all US1 tests together
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 3)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (config, lib/auth.py, main.py, test conftest)
3. Complete Phase 3: US1 (login + me + logout + tests)
4. Complete Phase 5: US3 (RBAC + service role tests)
5. **STOP and VALIDATE**: All auth + RBAC tests pass → Feature 004+ can be protected
6. Minimum viable auth is complete

### Incremental Delivery

1. Setup + Foundational → app boots, auth library works
2. US1 → login/logout/me tested → Feature 011 can generate service token
3. US2 → token refresh tested → dashboard session management works
4. US3 → RBAC tested → admin routes safe to build in Features 004+
5. US4 → health endpoint → infrastructure monitoring works
6. US5 → rate limiting → security hardened before any network exposure

---

## Notes

- Tests are **required** by spec (FR-011: all auth/authz logic must pass offline)
- `httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test")` — no real server; `ASGITransport` is from `httpx`
- `get_session()` dependency must be overridden in tests via `app.dependency_overrides[get_session] = lambda: test_session`
- `OperatorRepository` is mocked via `AsyncMock` — no real DB in route tests
- `require_role()` returns `Depends(...)` — test by calling the endpoint, not the function directly
- Service JWT (`role="service"`) is generated by Feature 011's seed script; `create_access_token` already supports it via the `sub` and `role` parameters — no new function needed
- `slowapi` limiter must use `MemoryStorage` in tests (not Redis) — configure via fixture or env var `ENVIRONMENT=test`
- The test-only `GET /auth/admin-only` endpoint (T016) has `include_in_schema=False` — it does not appear in the OpenAPI docs
- `AllConfigs` now has 6 fields including `api: ApiConfig` — T023 verifies this in the existing config test file
