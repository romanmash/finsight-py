# Research: API & JWT Auth (003)

## JWT library choice

**Chosen**: `python-jose[cryptography]` for token creation/verification
**Rationale**: Industry-standard Python JWT library; supports HS256 and RS256; well-maintained; used in FastAPI's own official security documentation examples.
**Alternatives considered**: `PyJWT` (also valid; slightly simpler API), `authlib` (heavier, more suited for OAuth server)

## Password hashing

**Chosen**: `passlib[bcrypt]` with `CryptContext(schemes=["bcrypt"])`
**Rationale**: bcrypt is the standard choice for password hashing; passlib wraps it with a convenient verify/hash API; widely used in FastAPI ecosystem.
**Alternatives considered**: argon2 (more modern but less common in Python tutorials), plain hashlib (not suitable for passwords)

## Rate limiting on auth endpoints

**Chosen**: `slowapi` (Starlette/FastAPI port of flask-limiter) with Redis as storage backend
**Rationale**: FastAPI-native; decorator-based; uses Redis for distributed rate limit counters (same Redis instance used elsewhere); configurable limits in YAML.
**Alternatives considered**: Custom middleware (more code to maintain), nginx rate limiting (outside app scope)

## Refresh token rotation strategy

**Chosen**: Single-use refresh tokens stored in the `refresh_tokens` DB table. On each `/auth/refresh` call, the current token is invalidated and a new one issued. Revocation is guaranteed via DB delete.
**Rationale**: Rotation prevents refresh token theft — a stolen token can only be used once before it's invalidated. DB storage enables revocation at logout.
**Alternatives considered**: Redis-stored tokens (less durable), stateless JWT refresh (cannot revoke)

## httpOnly cookie for refresh token

**Chosen**: Set refresh token as `httpOnly=True, secure=True, samesite="lax"` cookie via `response.set_cookie()`
**Rationale**: httpOnly prevents JavaScript access; constitution rule. samesite=lax prevents CSRF for cross-site requests while allowing same-site navigation.
**Alternatives considered**: Local storage (explicitly excluded by constitution), Authorization header for refresh (less secure)

## RBAC implementation

**Chosen**: `require_role(role: str)` returns a FastAPI `Depends`-compatible callable that reads the role from the decoded JWT claim. Used as `Depends(require_role("admin"))` on admin routes.
**Rationale**: Reusable, composable with other dependencies, zero boilerplate at point of use.
**Alternatives considered**: Custom middleware (can't read route-level role requirements), attribute-based access (overkill for two roles)

## FastAPI app structure

**Chosen**: Single `FastAPI()` instance in `apps/api/src/api/main.py`; routers registered via `app.include_router()`; middleware stack: CORSMiddleware, TrustedHostMiddleware (prod), SlowAPI middleware.
**Rationale**: Single app instance is the FastAPI standard; router-per-feature keeps concerns separated; middleware order matters (CORS before rate limiting).
**Alternatives considered**: Multiple FastAPI apps mounted via `app.mount()` (not needed at this scale)

## Offline test strategy

**Chosen**: `httpx.AsyncClient(app=app, base_url="http://test")` as the test HTTP client; `AsyncMock` to patch DB repositories; `fakeredis` for rate limit counters.
**Rationale**: httpx AsyncClient is the FastAPI-recommended test client for async tests; no real server needed; respx not required here since we mock at the repository layer not HTTP layer.
**Alternatives considered**: `TestClient` (sync only), real database (violates offline constraint)
