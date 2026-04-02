# Quickstart: Seed & Infrastructure Readiness (011)

## Prerequisites

- Node.js 20 LTS and pnpm installed.
- Local `.env` created from `.env.example` with required values.
- PostgreSQL/Redis available for app and seed execution.
- Docker/Compose available for deployment verification paths.

## 1. Install and Validate Workspace

```bash
pnpm install
pnpm -r typecheck
pnpm -r lint
pnpm -r test -- --pool=threads
```

Expected: all checks pass.

## 2. Execute Seed Bootstrap

```bash
pnpm prisma db seed
```

Expected:
- Command exits successfully.
- Demo-critical domains are populated (users, holdings/watchlists, KB/history, missions/agent runs, alerts, screener baseline, ingestion baseline).

## 3. Verify Seed Idempotency

Run seed again:

```bash
pnpm prisma db seed
```

Expected:
- No duplicate-conflict errors.
- Existing records are reconciled safely.

## 4. Validate Demo-Critical Read Paths

Use existing API paths/UI checks to verify seeded baseline visibility:

- Thesis read path returns populated current thesis.
- Thesis-history path returns non-empty progression including contradiction transition.
- Alerts read path returns seeded pending alert context.
- Missions/admin status surfaces show non-empty operational history.

## 5. CI/CD Contract Smoke Check

- Open PR to integration branch and confirm validation-only run.
- Merge/push to main/release branch and confirm deploy-eligible workflow path (after gate success).

## 6. Deploy Script Contract Check

```bash
./scripts/deploy.sh
```

Expected:
- Preflight passes.
- Artifacts sync completes.
- Remote service update/restart succeeds.
- Post-deploy health checks pass.

## 7. Logs Helper Contract Check

```bash
./scripts/logs.sh <service-name>
```

Expected:
- Live logs stream for selected service/container target.

## 8. Infrastructure Preview Check

```bash
cd infra/pulumi
pulumi preview
```

Expected:
- Stack plan resolves without fatal configuration/validation errors.

## Troubleshooting

- Seed fails immediately: verify migrations and required env values are present.
- Duplicate/conflict on rerun: inspect reconciliation keys and upsert criteria.
- Deploy fails at sync/restart: verify SSH connectivity, remote paths, and compose project context.
- Health checks fail: inspect service logs with `scripts/logs.sh` and dashboard/admin health surface.
- Workflow deploy runs unexpectedly: verify branch-gating conditions in workflow contract.

### Optional concrete API verification examples

When API contracts from earlier features are available, recommended smoke checks include:

- `GET /api/kb/thesis/NVDA`
- `GET /api/kb/history/NVDA`
- `GET /api/alerts` (admin context)
- `GET /api/missions`

These are compatibility checks preserved from the original manual draft and should be included in task-level verification.

## 9. Branch Trigger Verification Steps

1. Open PR into `develop` and confirm `typecheck`, `lint`, `test`, and `build` jobs run.
2. Confirm `deploy` job is skipped for the PR event.
3. Push to `main` and confirm `deploy` executes only after prior jobs pass.

## 10. Logs Helper Failure-Mode Checks

- Run `pnpm logs:remote` without a service argument and verify non-zero exit.
- Run `pnpm logs:remote -- missing-service` and verify remote compose returns a target lookup error.

## 11. Pulumi Preview Validation Steps

```bash
cd infra/pulumi
pulumi stack select dev
pulumi preview
```

Expected:
- Preview resolves planned resource groups with no fatal config errors.
- Healthcheck targets in `infra/pulumi/index.ts` align with deployment verification expectations.

## 12. SC-005 Measurement Method and Evidence Template

Measure post-deploy health with a rolling 5-minute window after each deployment:

1. Capture deployment completion timestamp (`t0`).
2. Poll each required health endpoint from `HEALTHCHECK_URLS` until `t0 + 5m`.
3. Count a deployment as successful only if all required services report healthy within the window.
4. Record at least 20 deployments; target pass rate >=95%.

Evidence template:

| Deployment ID | Completed At (UTC) | All Services Healthy <=5m | Duration To Healthy (s) | Notes |
|---|---|---|---:|---|
| deploy-001 | 2026-04-01T10:00:00Z | yes/no | 0 | |

## 13. Validation Evidence (2026-04-01)

Executed from repository root:

- `pnpm -r typecheck` -> PASS
- `pnpm -r lint` -> PASS
- `pnpm -r test -- --pool=threads` -> PASS
- `pnpm check:secrets` -> PASS
- `node tools/validation/check-011-parity.mjs` -> PASS
- `node tools/validation/validate-ci-cd-policy.mjs` -> PASS
- `node tools/validation/validate-env-contract.mjs` -> PASS
- `node tools/validation/validate-pulumi-preview.mjs` -> PASS

Operational notes:

- Workspace gates passed locally.
- Deployment and remote log smoke checks still require configured remote host credentials (`DEPLOY_HOST`, `DEPLOY_USER`).
- Pulumi runtime provisioning remains operator-driven and was validated at contract level in this pass.
