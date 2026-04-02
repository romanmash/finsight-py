# Feature Specification: Seed & Infrastructure

**Feature**: `011-seed-infrastructure`
**Created**: 2026-03-28
**Status**: Draft
**Constitution**: [`.specify/memory/constitution.md`](../../.specify/memory/constitution.md)
**Depends on**: All preceding features (001–010)

## Overview

Create the seed script that populates the database with demo-ready data, the Pulumi IaC for AWS deployment, the CI/CD GitHub Actions workflow, deployment scripts, and environment variable documentation. This is the final feature that makes the platform demo-ready and deployable.

**Why this feature exists:** The demo is everything. A cold-start empty database shows nothing impressive. The seed script creates a "lived-in" state: existing theses, historical snapshots, prior missions, pending alerts, and a screener run — so the demo starts from a rich baseline that showcases every feature. The IaC and CI/CD prove the system is production-ready, not just a local prototype.

---

## User Scenarios & Testing

### User Story 1 — Seed Script (Priority: P1)

As a developer setting up the demo, I want a single command that populates the entire database with realistic data so that every feature is immediately demonstrable.

**Why P1**: The demo script (CASE.md §17) depends entirely on seed data existing. Without seed, `/thesis NVDA`, `/history NVDA`, and the admin dashboard all show empty states.

**Independent Test**: Run `pnpm prisma db seed`, then verify each seeded entity exists via API.

**Acceptance Scenarios**:

1. **Given** a fresh database, **When** `pnpm prisma db seed` runs, **Then** all seed data is created without error
2. **Given** seed has already run, **When** `pnpm prisma db seed` runs again, **Then** it completes idempotently (no duplicate errors)
3. **Given** seed has run, **When** `GET /api/kb/thesis/NVDA` is called, **Then** the current bullish thesis is returned
4. **Given** seed has run, **When** `GET /api/kb/history/NVDA` is called, **Then** 4 snapshots are returned including one with `changeType: 'contradiction'`
5. **Given** seed has run, **When** `GET /api/alerts` is called for admin, **Then** 1 `earnings_approaching` alert is returned
6. **Given** seed has run, **When** `GET /api/missions` is called, **Then** 2 prior missions are returned with AgentRun records
7. **Given** seed has run, **When** the admin dashboard loads, **Then** all panels show populated data

---

### User Story 2 — CI/CD Pipeline (Priority: P1)

As a developer, I want automated CI that runs on every PR and deploys on merge to main so that code quality is enforced and deployment is reliable.

**Why P1**: CI proves the project has professional engineering standards. The self-hosted runner shows infrastructure capability.

**Independent Test**: Push a commit to `develop`, verify CI runs. Merge to `main`, verify deploy runs.

**Acceptance Scenarios**:

1. **Given** a PR to `develop`, **When** CI runs, **Then** it executes: typecheck → lint → test → build
2. **Given** a push to `main`, **When** CI runs, **Then** it also executes the deploy job
3. **Given** CI is on a self-hosted runner, **Then** it uses the Linux server's Docker for builds
4. **Given** any CI step fails, **Then** the pipeline stops and reports the failure

---

### User Story 3 — Deployment Scripts (Priority: P1)

As a developer, I want a deploy script that deploys to the Linux server via SSH so that I can iterate quickly without manual steps.

**Why P1**: Rapid iteration during development. The deploy script is the primary deployment mechanism.

**Independent Test**: Run `./scripts/deploy.sh`, verify services restart and health checks pass on the server.

**Acceptance Scenarios**:

1. **Given** `./scripts/deploy.sh` is run, **When** it completes, **Then** config files and compose files are synced to the server via rsync
2. **Given** files are synced, **Then** `docker compose up -d` runs on the server and all services restart
3. **Given** services restart, **Then** health checks pass for API and all MCP servers
4. **Given** `./scripts/logs.sh hono-api` is run, **Then** it tails logs for the named container on the server

---

### User Story 4 — Pulumi AWS IaC (Priority: P2)

As a developer, I want AWS infrastructure defined as code so that the system can be deployed to the cloud for a production demo.

**Why P2**: Cloud deployment is a stretch goal. The system runs perfectly on the Linux server.

**Independent Test**: Run `pulumi preview` and verify all resources are planned without errors.

**Acceptance Scenarios**:

1. **Given** Pulumi config is set, **When** `pulumi up` is run, **Then** it creates VPC, ECS cluster, RDS, ElastiCache, ECR repos, task definitions, services, and ALB
2. **Given** the stack is up, **Then** the API is reachable via ALB DNS

---

### User Story 5 — Environment Documentation (Priority: P1)

As a developer, I want a complete `.env.example` with all required variables so that setup is self-documenting.

**Why P1**: Missing environment variables cause cryptic failures. The example file prevents this.

**Independent Test**: Copy `.env.example` to `.env`, fill in values, verify the system starts.

**Acceptance Scenarios**:

1. **Given** `.env.example` exists, **Then** it documents every required environment variable with comments and example formats
2. **Given** all variables from `.env.example` are set, **Then** the system starts without "missing env var" errors

---

### Edge Cases

- What if seed runs before migrations? → Error — seed checks for tables and provides helpful message
- What if embedding API is unavailable during seed? → Seed fails with clear error (embeddings are required for KB entries)
- What if the Linux server is unreachable during deploy? → Deploy script fails with SSH error
- What if Pulumi state is corrupted? → Use `pulumi stack export/import` for recovery

---

## Requirements

### Functional Requirements

#### Seed Script
- **FR-001**: MUST be idempotent — safe to run multiple times
- **FR-002**: MUST create admin user with email from `ADMIN_EMAIL` env and password from `ADMIN_PASSWORD` env
- **FR-003**: MUST create analyst user (`analyst@finsight.local`, password: `demo1234`)
- **FR-004**: MUST create admin portfolio: NVDA 50, AAPL 100, GLD 20
- **FR-005**: MUST create admin watchlists: "portfolio" (NVDA, AAPL, GLD), "interesting" (SPY, AMD, MSFT)
- **FR-006**: MUST create NVDA KB entry with vector embedding (1536 dimensions via OpenAI embeddings)
- **FR-007**: MUST create 4 KbThesisSnapshots for NVDA dated -10d/-7d/-4d/-1d (cautious → neutral → contradiction → bullish)
- **FR-008**: MUST create 1 ScreenerRun (today, scheduled, 3 finds including AMD semiconductors)
- **FR-009**: MUST create 1 Alert (earnings_approaching, NVDA, high severity, 2 days from now)
- **FR-010**: MUST create 2 prior Missions with AgentRun records (daily_brief and pattern_request)
- **FR-011**: MUST create 3 ingested document entries (hardcoded earnings transcript text, chunked and embedded)

#### CI/CD
- **FR-012**: GitHub Actions workflow MUST run on self-hosted runner
- **FR-013**: CI jobs: typecheck → lint → test → build (all sequential)
- **FR-014**: Deploy job: MUST run only on `main` branch push
- **FR-015**: PR to `develop` MUST trigger CI but NOT deploy

#### Deploy Scripts
- **FR-016**: `scripts/deploy.sh` MUST sync configs and compose files via rsync, then restart via SSH
- **FR-017**: `scripts/deploy.sh` MUST verify health after deploy
- **FR-018**: `scripts/logs.sh` MUST tail logs for a named service on the server

#### Environment
- **FR-019**: `.env.example` MUST document all required variables with comments

### Seed Data Summary

| Entity | Count | Key Details |
|---|---|---|
| Users | 2 | admin + analyst |
| Portfolio Items | 3 | NVDA 50, AAPL 100, GLD 20 |
| Watchlists | 2 | "portfolio" (3 tickers), "interesting" (3 tickers) |
| KB Entry (NVDA) | 1 | Current bullish thesis with embedding |
| KB Thesis Snapshots | 4 | -10d cautious, -7d neutral, -4d contradiction, -1d bullish |
| Screener Run | 1 | 3 sector finds |
| Alert | 1 | earnings_approaching, NVDA |
| Prior Missions | 2 | daily_brief + pattern_request with AgentRuns |
| Ingested Documents | 3 | Earnings transcript chunks with embeddings |

---

## Success Criteria

- **SC-001**: `pnpm prisma db seed` runs idempotently
- **SC-002**: After seed: `GET /api/kb/thesis/NVDA` returns bullish thesis
- **SC-003**: After seed: `GET /api/kb/history/NVDA` returns 4 snapshots
- **SC-004**: After seed: `GET /api/alerts` returns 1 alert
- **SC-005**: After seed: `GET /api/missions` returns 2 missions
- **SC-006**: CI runs all jobs on self-hosted runner
- **SC-007**: Deploy script successfully deploys to Linux server
- **SC-008**: `.env.example` covers all required variables
