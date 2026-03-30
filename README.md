# FinSight AI Hub

> Multi-agent fintech market intelligence platform — 9 specialist agents, 6 MCP tool servers, real-time admin dashboard.

## Quick Start

```bash
# Prerequisites: Node.js 20 LTS, pnpm 9, Docker/Podman
pnpm install
cp .env.example .env             # Configure API keys
docker compose up -d postgres redis
pnpm prisma migrate dev --name init
pnpm prisma db seed
pnpm -r test                     # Verify offline tests pass
docker compose up -d             # Start all 12 containers
```

## Architecture

```
┌─────────────────────── Telegram Bot ───────────────────────┐
│                      (user interface)                      │
└───────────────────────────┬────────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────────┐
│                     Hono API + Manager                     │
│            (auth, routing, orchestration)                   │
├──────────────┬──────────────┬──────────────┬───────────────┤
│  Researcher  │   Analyst    │  Bookkeeper  │   Reporter    │
│  Watchdog    │  Technician  │    Trader    │   Screener    │
└──────┬───────┴──────────────┴──────┬───────┴───────────────┘
       │                             │
┌──────▼─────────────────────────────▼───────────────────────┐
│              6 MCP Tool Servers (Hono)                     │
│  market-data │ macro-signals │ news │ rag │ enterprise │   │
│              │               │      │     │ trader-plat │  │
└──────────────┴───────────────┴──────┴─────┴────────────────┘
       │                             │
┌──────▼─────────────────────────────▼───────────────────────┐
│         PostgreSQL (pgvector)  │  Redis + BullMQ           │
└────────────────────────────────┴───────────────────────────┘
```

## Repository Structure

| Directory | Purpose |
|---|---|
| `packages/shared-types/` | `@finsight/shared-types` — domain types, zero runtime deps |
| `apps/api/` | Hono API, 9 agents, BullMQ workers |
| `apps/mcp-servers/` | 6 independent MCP tool servers |
| `apps/dashboard/` | React admin dashboard (Vite) |
| `apps/telegram-bot/` | Telegraf polling bot |
| `config/runtime/` | 11 YAML config files |
| `config/types/` | Zod validation schemas |
| `prisma/` | Schema, migrations, seed |
| `infra/` | Pulumi IaC |
| `specs/` | Feature specs (SpecKit methodology) |
| `docs/` | System specification + architecture docs |

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for workflow, commit conventions, and PR checklist.

### Key Commands

```bash
pnpm -r typecheck     # TypeScript strict (zero errors)
pnpm -r lint          # ESLint (zero warnings)
pnpm -r test          # All tests (offline, no Docker)
```

## Documentation

| Document | Purpose |
|---|---|
| [Constitution](/.specify/memory/constitution.md) | Non-negotiable project principles |
| [Feature Specs](/specs/README.md) | SpecKit feature catalogue |
| [System Spec](/docs/CASE.md) | Full system specification |
| [Architecture](/docs/CONTEXT.md) | Decisions + constraints |
| [Dashboard Reference](/docs/dashboard-reference.html) | Visual spec for admin UI |

## AI Agent Support

This repo is configured for AI-assisted development:

| Agent | Config | Instructions |
|---|---|---|
| **Claude Code** | `CLAUDE.md` + `.claude/commands/` | 4 slash commands: `/implement`, `/review`, `/commit`, `/plan` |
| **Codex CLI** | `.codex/config.toml` | Reads `AGENTS.md` |
| **Any agent** | `AGENTS.md` | Universal instructions |

## Tech Stack

Node.js 20 · TypeScript 5 strict · pnpm · Hono · Prisma · pgvector · BullMQ · Redis · Vercel AI SDK · Telegraf · React · Vite · Pulumi · Docker

## License

Private — portfolio demonstration project.
