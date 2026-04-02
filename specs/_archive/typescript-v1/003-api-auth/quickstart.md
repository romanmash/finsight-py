# Quickstart: API & Auth (003)

## Prerequisites

- Feature 001 and 002 completed
- `pnpm install` completed
- `.env` configured with auth/database/redis variables
- Postgres and Redis running (`docker compose up -d postgres redis`)

## 1) Validate planning artifacts

Ensure these files exist:

- `specs/003-api-auth/plan.md`
- `specs/003-api-auth/research.md`
- `specs/003-api-auth/data-model.md`
- `specs/003-api-auth/contracts/api-auth-routes.md`
- `specs/003-api-auth/quickstart.md`

## 2) Implement feature tasks (next step)

After `/speckit.tasks` generates task list:

```bash
# plan -> tasks -> implement workflow
/speckit.tasks
/speckit.implement
```

## 3) Post-implementation validation targets

Authentication flows:

```bash
# expected: success login returns access token and sets httpOnly refresh cookie
# set these in your shell first:
#   AUTH_EMAIL=admin@finsight.local
#   AUTH_PASSWORD=<your-password>
curl -i -c cookies.txt -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$AUTH_EMAIL\",\"password\":\"$AUTH_PASSWORD\"}"

# expected: valid token returns user profile
curl -H "Authorization: Bearer <token>" http://localhost:3000/auth/me

# expected: refresh uses cookie and returns new access token
curl -b cookies.txt -X POST http://localhost:3000/auth/refresh
```

Admin/status flows:

```bash
# expected: complete status payload (or degraded with explicit markers)
curl -H "Authorization: Bearer <admin-token>" http://localhost:3000/api/admin/status

# expected: queue trigger returns 202
curl -X POST -H "Authorization: Bearer <admin-token>" http://localhost:3000/api/watchdog/trigger
curl -X POST -H "Authorization: Bearer <admin-token>" http://localhost:3000/api/screener/trigger
```

Quality gates:

```bash
pnpm -r typecheck
pnpm -r lint
pnpm -r test
```

Expected:
- zero type errors
- zero lint warnings
- passing route/middleware/auth/status tests

## 4) Failure-mode verification targets

- Invalid credentials -> `401`
- Non-admin on admin route -> `403`
- Rate-limit breach -> `429`
- Redis down during refresh/logout -> `503`
- Redis down during status -> degraded/partial payload with explicit health markers
- Status endpoint response completes within 5 seconds

## 5) Implementation Validation Results (2026-03-30)

Executed commands and outcomes:

```bash
pnpm prisma generate
pnpm --filter @finsight/api typecheck
pnpm --filter @finsight/api lint
pnpm --filter @finsight/api test
pnpm -r typecheck
pnpm -r lint
pnpm -r test
```

Observed status:
- `@finsight/api` typecheck: PASS
- `@finsight/api` lint: PASS
- `@finsight/api` tests: PASS (48 passed)
- workspace typecheck/lint: PASS
- workspace tests: PASS (shared-types + api)

Notes:
- Test execution in this environment required elevated execution due sandbox worker/process restrictions.
- Config-loader negative-case tests intentionally log validation failures while still passing as expected assertions.
