# AGENTS.md

Instructions for AI coding assistants working on the FinSight AI Hub repository.

## Project Overview

FinSight AI Hub is a multi-agent fintech market intelligence platform built with TypeScript, Hono, Prisma, and the Vercel AI SDK. 9 specialist agents collaborate through a Manager orchestrator. Data flows through 6 independent MCP tool servers. Users interact via Telegram; admins monitor via a React dashboard.

**This is a Spec-Driven Development project.** All implementation is governed by feature specs in `specs/NNN-feature-name/`.

## Read Order (mandatory before any implementation)

1. `.specify/memory/constitution.md` — non-negotiable principles and quality gates
2. `specs/README.md` — feature catalogue with build order and dependencies
3. The specific `specs/NNN-feature-name/spec.md` for your current task
4. The specific `specs/NNN-feature-name/plan.md` for implementation details
5. `docs/CONTEXT.md` — architectural decisions and environment constraints
6. `docs/CASE.md` — full system specification (reference, not required in full)

## Architecture

```
packages/shared-types/         → @finsight/shared-types (domain types, zero dependencies)
apps/api/                      → Hono API + all 9 agents + BullMQ workers
apps/api/src/agents/           → 9 agent implementations + colocated prompts (*.prompt.ts)
apps/api/src/agents/shared/    → Shared prompt fragments
apps/api/src/mcp/              → MCP client (tool registration) + model router
apps/api/src/routes/           → Hono route modules (auth, admin, chat, missions, kb, etc.)
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

## Rules (NON-NEGOTIABLE)

1. **Read the constitution first** — `.specify/memory/constitution.md` defines project principles, agent boundaries, and quality gates. Every implementation decision must be justifiable against it.
2. **Spec scope is strict** — each feature spec lists exactly which files to create. Do NOT implement code from other specs. Do NOT add features not in the current spec.
3. **Everything-as-Code** — all behavioral configuration lives in `config/runtime/*.yaml`, validated by Zod at startup. No hardcoded model names, thresholds, or schedules in source code.
4. **TypeScript strict mode** — no `any`, explicit return types on every function, all domain types from `@finsight/shared-types`.
5. **Agent boundaries** — each agent has a sole responsibility. Do not let Researcher synthesise, Analyst fetch, Reporter analyse, or Bookkeeper format. See constitution.
6. **Test offline** — all tests must pass without network access, without LM Studio, without Docker. Mock external APIs with `msw`.
7. **Conventional Commits** — `<type>(<scope>): <description>`. Types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`. Scopes: `types`, `config`, `api`, `mcp`, `agents`, `manager`, `kb`, `dashboard`, `telegram`, `prisma`, `infra`, `spec`.
8. **Fail-fast config** — if any YAML file is invalid at startup, call `process.exit(1)` with the exact Zod error path. Never start with bad config.
9. **Cost tracking** — every LLM call must record `tokensIn`, `tokensOut`, `costUsd`, `provider`, `model`, `durationMs` in an `AgentRun` record.
10. **Colocated prompts** — agent prompts live at `agents/X.prompt.ts` alongside `agents/X.ts`. Shared prompts in `agents/shared/`.

## Development Workflow

1. **Read** the constitution: `.specify/memory/constitution.md`
2. **Read** the feature catalogue: `specs/README.md`
3. **Read** the target spec: `specs/NNN-feature-name/spec.md`
4. **Read** the implementation plan: `specs/NNN-feature-name/plan.md`
5. **Implement** only the files listed in the plan
6. **Test** with `pnpm -r test` (must pass offline)
7. **Typecheck** with `pnpm -r typecheck` (zero errors)
8. **Commit** using conventional commit format

## Key Commands

```bash
pnpm install                     # Install all workspace dependencies
pnpm -r typecheck                # TypeScript strict check across all packages
pnpm -r lint                     # ESLint flat config (zero warnings)
pnpm -r test                     # Run all tests (offline, no Docker required)
pnpm prisma migrate dev          # Apply database migrations
pnpm prisma db seed              # Load demo data
docker compose up -d             # Start all 12 containers
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d  # Dev mode
```

## Key Files

| File | Purpose | Modify? |
|---|---|---|
| `.specify/memory/constitution.md` | Project principles + quality gates | Only with documented rationale |
| `specs/NNN-*/spec.md` | Feature PRDs — user stories, acceptance criteria | Reference only during implementation |
| `specs/NNN-*/plan.md` | Feature SDDs — technical design, file list | Reference only during implementation |
| `docs/CASE.md` | Full system specification (2000+ lines) | Update if schema/architecture changes |
| `docs/CONTEXT.md` | Architecture decisions and constraints | Reference only |
| `docs/SPECKIT.md` | Original 14-component briefs with detailed TypeScript interfaces | Reference when writing `plan.md` |
| `config/runtime/*.yaml` | Runtime configuration (Everything-as-Code) | Update values as needed |
| `prisma/schema.prisma` | Database schema (source of truth) | Change via migrations only |
| `CLAUDE.md` | Claude Code entry point — imports `@AGENTS.md` | Do not edit directly |

## Technology Stack (Locked)

| Layer | Technology | Why |
|---|---|---|
| Runtime | Node.js 20 LTS, TypeScript 5.x strict | Position requirement |
| Monorepo | pnpm workspaces | Fast, disk-efficient, strict |
| API | Hono | Fast, Web Standards, great DX |
| ORM | Prisma + pgvector | Type-safe, migrations, vector search |
| Queue | BullMQ + Redis 7 | Repeatable jobs, retries |
| AI SDK | Vercel AI SDK (`ai` package) | Multi-provider, tool() bindings |
| Observability | LangSmith + Pino | LLM traces + structured logs |
| Bot | Telegraf | Polling-based, mature |
| Dashboard | React + Vite (vanilla CSS) | Fast build, no framework overhead |
| IaC | Pulumi (TypeScript) | TypeScript-native IaC |
| Container | Docker (prod) / Podman (dev) | OCI-compatible |

## Safety

- `.env` is gitignored — secrets NEVER in source control
- `config/runtime/` is mounted `:ro` in containers — immutable at runtime
- JWT access tokens in memory only — NOT localStorage
- Refresh tokens in httpOnly cookies
- Admin routes behind `roleGuard('admin')`
- Trader creates tickets — NEVER executes trades autonomously
- Any unknown model in `pricing.yaml` → cost = $0 with warning (never block)
