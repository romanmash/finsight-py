# Seed & Infrastructure Contracts (011)

## Purpose

Defines interface contracts for seed execution, CI/CD workflow behavior, deployment scripts, logs helper, and environment variable documentation in feature 011.

## Seed Execution Contract

### Command

- `pnpm prisma db seed`

### Expected Behavior

- Safe to run repeatedly without duplicate logical entities.
- Produces deterministic demo-ready baseline across required domains.
- Returns non-zero exit code on prerequisite/config/data validation failure.
- Hard-fails if any demo-critical domain cannot be seeded/reconciled.
- Allows warning-only continuation solely for explicitly non-critical seed supplements.

### Outcome Envelope (logical contract)

```json
{
  "status": "success",
  "created": {
    "users": 0,
    "portfolioItems": 0,
    "watchlistItems": 0,
    "kbEntries": 0,
    "kbThesisSnapshots": 0,
    "missions": 0,
    "agentRuns": 0,
    "alerts": 0,
    "screenerRuns": 0
  },
  "updated": {
    "users": 2,
    "kbEntries": 1
  },
  "warnings": []
}
```

Notes:
- Exact transport/log format is implementation-defined.
- Semantic fields above must be recoverable from output for verification.

### Reconciliation Precedence Contract

- Baseline-managed fields are authoritative and are reconciled to seed-profile intent on rerun.
- Runtime metadata outside baseline-managed scope is preserved by default.
- Any expansion of seed-managed mutable fields must be documented in feature artifacts before implementation.

## CI/CD Workflow Contract

### Workflow File

- `.github/workflows/ci-cd.yml`

### Trigger Policy

- Pull request to integration branch: validation stages run, deploy stage is not eligible.
- Push to release/main branch: validation stages run, deploy stage eligible only after validation success.

### Stage Order Contract

1. `typecheck`
2. `lint`
3. `test`
4. `build`
5. `deploy` (branch-gated)

If any stage 1-4 fails, `deploy` must not run.

## Deployment Script Contract

### Script

- `scripts/deploy.sh`

### Inputs

- Remote host/user context (from args or env)
- Target compose/runtime artifact paths

### Required Behavior

- Perform preflight validation.
- Synchronize required runtime/config artifacts to target.
- Execute remote service update/restart action.
- Execute post-deploy health checks.
- Exit non-zero on any failed stage.

### IaC Separation Contract

- `scripts/deploy.sh` and CI deploy stages roll out application/runtime artifacts to an already provisioned target.
- Pulumi preview/provision remains an explicit operator workflow and is not implicitly auto-applied by the CI deploy stage in this feature.

## Logs Helper Contract

### Script

- `scripts/logs.sh`

### Inputs

- Service/container identifier argument (required)

### Required Behavior

- Validate input target is provided.
- Stream logs for selected target from deployment host.
- Exit non-zero on connection/lookup failure.

## Environment Variable Contract

### Artifact

- `.env.example`

### Required Behavior

- Enumerates all required variables for local runtime, seed, CI/deploy integration, and deployment scripts.
- Uses placeholders (no real secrets).
- Provides enough semantic context for onboarding without external guesswork.

## Verification Contract

A feature-011 validation pass is successful only when all below hold:

1. Seed command passes on clean environment.
2. Seed rerun passes without duplicate-conflict failures.
3. Validation-only workflow path blocks deploy stage.
4. Deploy-eligible workflow path runs deploy only after gate success.
5. Deploy script performs sync + restart + health verification with deterministic exit behavior.
6. Logs helper tails selected target logs.
7. Environment contract is complete and startup validation reports no missing required keys when populated.

## CI/CD Branch Defaults (Concrete)

Unless repository policy changes explicitly, use these defaults:

- Integration PR branch: `develop` (validation-only)
- Release branch: `main` (deploy-capable after gates pass)

If project policy uses a different integration branch name, that change must be documented in workflow comments and tasks.

## CI/CD Runner Contract (Concrete)

- Workflow executes on self-hosted Linux runner with Docker available.
- Runner environment must be capable of build/test/deploy steps without interactive input.

## Seed Baseline Minimums (Concrete Preservation)

The implementation MUST include at minimum the following preserved demo baseline examples:

- User personas: admin + analyst
- Portfolio example: NVDA 50, AAPL 100, GLD 20
- Watchlists example:
  - `portfolio`: NVDA, AAPL, GLD
  - `interesting`: SPY, AMD, MSFT
- KB history example: 4-step progression including contradiction transition
- Alert example: one upcoming earnings-related high-severity alert
- Mission history example: at least two prior missions with associated AgentRun records
- Ingested document baseline: at least three entries suitable for retrieval demo

## IaC Resource Baseline (Concrete Preservation)

Pulumi planning scope should cover core runtime resources equivalent to:

- Network baseline (VPC/subnets/security groups)
- Compute/service baseline (cluster/services/task definitions)
- Data baseline (relational DB + cache)
- Image registry baseline
- Ingress/load-balancer baseline

Exact resource naming and decomposition remain implementation details.

## Seed Verification Matrix (Concrete Minimums)

| Domain | Verification Query/Path | Expected Minimum |
|---|---|---|
| Users | `User` by admin + analyst email | 2 personas |
| Portfolio | `PortfolioItem` for admin | 3 rows (NVDA, AAPL, GLD) |
| Watchlists | `WatchlistItem` for admin | 6 rows across `portfolio` and `interesting` |
| Current Thesis | `KbEntry` where `ticker=NVDA` + `entryType=thesis_current` | 1 row |
| Thesis History | `KbThesisSnapshot` with seed summaries | 4 rows with contradiction transition |
| Screener | `ScreenerRun` where `triggeredBy=seed-011` | 1 row |
| Alerts | `Alert` with seed message prefix | 1 high-severity earnings entry |
| Mission History | `Mission` where `trigger=seed-011` | 2 rows |
| Agent Traces | `AgentRun` for seeded missions | 2 rows |
| Ingestion Baseline | `KbEntry` with `entryType=document_chunk` + seed-doc prefix | 3 rows |

## CI Gate-Order Verification Criteria

Validation evidence is acceptable only if:

1. Job graph shows `typecheck -> lint -> test -> build` dependency ordering.
2. `deploy` depends on `build` and is branch-gated to `main` push events.
3. Any failed gate in 1-4 prevents deploy execution.

## Deploy Script Stage Verification Checklist

- Preflight: required args/env/tools validated.
- Sync: runtime artifacts copied to remote target.
- Restart: remote compose update/restart command executed.
- Health: configured targets verified with non-zero exit on failure.

## Environment Contract Completeness Rules

- `.env.example` must contain placeholders (not real secrets) for every required seed/runtime/deploy key.
- Keys marked required for deploy automation (`DEPLOY_HOST`, `DEPLOY_USER`) must be documented with purpose comments.
- Validation script `tools/validation/validate-env-contract.mjs` must pass.
