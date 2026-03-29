# CLAUDE.md

Instructions for Claude (Opus, Sonnet) working on the FinSight AI Hub repository.

## Project Overview

FinSight AI Hub is a multi-agent fintech market intelligence platform. 9 specialist agents collaborate via a Manager orchestrator across 6 independent MCP tool servers, backed by PostgreSQL (pgvector), Redis, and BullMQ. The user interacts via Telegram; the admin monitors via a React dashboard.

## Read Order (mandatory before any implementation)

1. `.specify/constitution.md` — non-negotiable principles and quality gates
2. `specs/README.md` — feature catalogue with build order and dependencies
3. The specific `specs/NNN-feature-name/spec.md` for your current task
4. The specific `specs/NNN-feature-name/plan.md` for implementation details
5. `docs/CONTEXT.md` — architectural decisions and environment constraints
6. `docs/CASE.md` — full system specification (reference, not required in full)

## Architecture

```
packages/shared-types/         → @finsight/shared-types (domain types, zero dependencies)
apps/api/                      → Hono API + all 9 agents + BullMQ workers
apps/api/src/agents/           → Agent implementations + colocated prompts (*.prompt.ts)
apps/api/src/agents/shared/    → Shared prompt fragments
apps/api/src/mcp/              → MCP client (tool registration) + model router
apps/api/src/routes/           → Hono route modules
apps/api/src/lib/              → Singletons: db.ts, redis.ts, queues.ts, config.ts, pricing.ts
apps/api/src/workers/          → BullMQ workers: watchdog, screener, brief, earnings, alert
apps/mcp-servers/              → 6 independent MCP servers (each a separate Hono app)
apps/dashboard/                → React SPA (Vite, vanilla CSS)
apps/telegram-bot/             → Telegraf polling bot
config/runtime/                → 11 YAML config files (Everything-as-Code)
config/types/                  → Zod schemas for YAML validation
prisma/                        → Schema, migrations, seed.ts
infra/                         → Pulumi IaC (TypeScript)
scripts/                       → deploy.sh, logs.sh
```

## Rules

1. **Constitution is law** — read `.specify/constitution.md` before writing code. Agent boundaries, fail-safe defaults, and testing standards are NON-NEGOTIABLE.
2. **Spec scope is strict** — when implementing a feature, stay within that spec's file list. Do not implement features from future specs.
3. **Everything-as-Code** — all behavioral configuration lives in `config/runtime/*.yaml`. No hardcoded thresholds, model names, or schedules in TypeScript source.
4. **No `any`** — TypeScript strict mode. Every function has explicit return types. All imports from `@finsight/shared-types`. Every interface has JSDoc describing its purpose.
5. **Agent boundaries** — Researcher collects, Analyst synthesises, Bookkeeper writes KB, Reporter formats. No agent crosses into another's domain.
6. **Test offline** — mock all external APIs via `msw`. Tests must pass without network, without LM Studio, without Docker.
7. **Conventional Commits** — `<type>(<scope>): <description>`. Types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`. Scopes: `types`, `config`, `api`, `mcp`, `agents`, `manager`, `kb`, `dashboard`, `telegram`, `prisma`, `infra`, `spec`.
8. **Fail-fast config** — if any YAML file is invalid at startup, call `process.exit(1)` with the exact Zod error path. Never start with bad config.
9. **Cost tracking** — every LLM call must record `tokensIn`, `tokensOut`, `costUsd`, `provider`, `model`, `durationMs` in an `AgentRun` record.
10. **Colocated prompts** — agent prompts live at `agents/X.prompt.ts` alongside `agents/X.ts`. Shared prompts in `agents/shared/`.

## Key Commands

```bash
pnpm install                     # Install all dependencies
pnpm -r typecheck                # TypeScript strict check (zero errors)
pnpm -r lint                     # ESLint (zero warnings)
pnpm -r test                     # Run all tests (offline, no Docker)
pnpm prisma migrate dev          # Apply DB migrations
pnpm prisma db seed              # Seed demo data
docker compose up -d             # Start all 12 containers
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d  # Dev mode
```

## Key Files

| File | Purpose | Modify? |
|---|---|---|
| `.specify/constitution.md` | Project principles + quality gates | Only with rationale |
| `specs/NNN-*/spec.md` | Feature PRDs (user stories, acceptance) | Reference only during impl |
| `specs/NNN-*/plan.md` | Technical design (SDDs) | Reference only during impl |
| `docs/CASE.md` | Full system specification | Rarely — update if schema changes |
| `docs/CONTEXT.md` | Architecture decisions | Reference only |
| `docs/SPECKIT.md` | Original 14-component briefs with detailed TypeScript interfaces | Reference when writing `plan.md` |
| `config/runtime/*.yaml` | Runtime configuration | Update defaults as needed |
| `prisma/schema.prisma` | Database schema | Update via migrations only |

## Technology Stack (Locked)

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 LTS, TypeScript 5.x strict |
| Monorepo | pnpm workspaces |
| API | Hono |
| ORM | Prisma + pgvector |
| Queue | BullMQ + Redis 7 |
| AI SDK | Vercel AI SDK (`ai` package) |
| Observability | LangSmith + Pino |
| Bot | Telegraf |
| Dashboard | React + Vite (vanilla CSS) |
| IaC | Pulumi (TypeScript) |
| Container | Docker (prod) / Podman (dev) |

## Safety

- `.env` is NEVER committed — secrets only via environment variables
- `config/runtime/` is mounted `:ro` in Docker containers
- JWT access tokens stored in memory only (NOT localStorage)
- Refresh tokens in httpOnly cookies
- All admin routes require `roleGuard('admin')`
- Trader NEVER executes trades — only creates tickets for human approval
- Any unknown model in `pricing.yaml` → cost = `$0` with warning (never block)
