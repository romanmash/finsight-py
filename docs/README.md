# FinSight AI Hub — Documentation

> **For AI agents and developers:** This file is the entry point for the `docs/` folder. It tells you what every document here is, what has already been decided, and how to get started. Architectural decisions have been finalised — your job is implementation.

---

## What Is This Project?

A private developer is applying for a freelance AI engineer position. The position requires hands-on experience with: multi-provider LLM integration, RAG + pgvector, agent workflows via Vercel AI SDK, MCP server architecture, internal enterprise connectors (Graph/SharePoint), event-driven patterns, LangSmith observability, TypeScript/Node.js, Hono, Prisma, PostgreSQL, Docker, AWS (Pulumi IaC), and Azure.

Instead of a generic demo, the developer is building **FinSight AI Hub** — a real, working fintech market intelligence platform that demonstrates every one of those requirements in a coherent domain. The system is simultaneously a portfolio demo and a tool the developer and a small group of friends will actually use.

See `POSITION.md` for the exact job description. See `TASK.md` for the original brief.

---

## Documents in This Folder

| File | Purpose | Read order |
|---|---|---|
| `TASK.md` | Original brief — the starting point | Reference only |
| `POSITION.md` | Exact freelance job description | Reference only |
| `SETUP.md` | Hardware and software specs for both machines | Reference only |
| `CASE.md` | **Full product specification** — architecture, agents, schemas, API, build plan, demo script | **Read first** |
| `CONTEXT.md` | Developer environment, design decisions, explicit constraints, rationale | **Read second** |
| `SPECKIT.md` | Original 14-component implementation briefs with detailed TypeScript interfaces — **superseded by `specs/` for the implementation workflow**, but valuable reference material when authoring `plan.md` files | Reference when writing `plan.md` |
| `dashboard-reference.html` | Self-contained renderable HTML of the Mission Control dashboard | Open in browser |

---

## What Has Been Decided — Do Not Change Without Reason

Everything in `CASE.md` and `CONTEXT.md` represents finalised decisions made through extensive design review. The key ones:

**Architecture**
- 9 specialist agents with strict non-overlapping responsibilities (CASE.md §3)
- Users interact via Telegram only — no web UI for users (CASE.md §4)
- Admin-only web dashboard (Mission Control) — React SPA, 4-column layout (CASE.md §4)
- 6 independent Hono MCP servers — pluggable, zero agent code changes for new data sources (CASE.md §11)
- BullMQ for all scheduled and event-driven jobs — not cron, not setInterval (CONTEXT.md §8)
- `hono-api` and `agent-worker` are separate containers sharing the same codebase (CONTEXT.md §4)

**Agent Boundaries**
- Researcher collects, never synthesises
- Analyst synthesises, calls no external tools
- Bookkeeper is the only KB writer — no exceptions
- Reporter uses local LM Studio (formatting only, free)
- Trader dispatches on explicit `/trade` command only (no auto-dispatch in PoC)
- `pattern_request` (Technician) does NOT write to KB

**Mission → Pipeline Routing**

| Mission Type | Pipeline |
|---|---|
| `operator_query` | KB fast-path check → Researcher → Analyst → Bookkeeper → Reporter |
| `comparison` | Researcher×N (parallel) → Analyst → Bookkeeper×N → Reporter |
| `devil_advocate` | Researcher → Analyst (devil's advocate) → Bookkeeper → Reporter |
| `pattern_request` | Technician → Reporter *(no KB write)* |
| `alert_investigation` | Researcher → Analyst → (optionally Technician) → Bookkeeper → Reporter |
| `earnings_prebrief` | Researcher → Analyst → Bookkeeper → Reporter |
| `trade_request` | Researcher → Analyst → Bookkeeper → Trader → Reporter |
| `daily_brief` | Researcher×N (parallel) → Analyst×N → Bookkeeper×N → Reporter |

**Config**
- All model names, temperatures, token limits, thresholds → `config/runtime/*.yaml`
- Nothing behavioural hardcoded in TypeScript
- Secrets only in `.env`, never in YAML

**Infrastructure**
- Dev laptop: Windows 11, Podman Desktop (Docker-compatible socket)
- Linux server: Ubuntu 24.04 Desktop, Docker Engine + Docker Compose
- LM Studio on dev laptop (RTX 5070 Ti), served to server over LAN
- Self-hosted GitHub Actions runner on Linux server

See `CONTEXT.md §9` for the full list of explicit constraints with reasons.

---

## Build Status

The repository foundation is in place. All 11 feature specs have `spec.md` complete (see `specs/README.md`). The next phase is creating `plan.md` for each spec in dependency order, then implementing.

**Build sequence (11 features in `specs/`):**

```
001 — Foundation & Config        (no dependencies — start here)
002 — Data Layer                 (depends on 001)
003 — API & Auth                 (depends on 001, 002)
004 — MCP Platform               (depends on 001, 002)
005 — Agent Infrastructure       (depends on 003, 004)
006 — Collector Agents           (depends on 004, 005)
007 — Reasoning Agents           (depends on 005, 006)
008 — Orchestration              (depends on 006, 007)
009 — Telegram Bot               (depends on 008)
010 — Admin Dashboard            (depends on 003, 008)
011 — Seed & Infrastructure      (depends on all above)
```

---

## How to Use These Docs with Claude Code / Codex

The workflow uses the slash commands configured in `.claude/commands/`:

1. **Read** `CASE.md` and `CONTEXT.md` for full project context (do this once, at the start)
2. **Check** `specs/README.md` to identify the next spec to work on
3. **Plan** — run `/plan NNN-feature-name` to generate `plan.md` from the spec
4. **Implement** — run `/implement NNN-feature-name` to implement all files in the plan
5. **Review** — run `/review NNN-feature-name` to validate against the constitution and spec
6. **Commit** — run `/commit` to generate a conventional commit message

**Starter prompt for Claude Code or Codex:**

```
Read .specify/memory/constitution.md, docs/CASE.md, and docs/CONTEXT.md.
Then run /plan 001-foundation-config to create the first implementation plan.
```

Each spec in `specs/NNN-*/spec.md` is self-contained — it includes all context needed for implementation without requiring the reader to have memorised all preceding specs.

---

## System Overview

### What FinSight Does

A team of 9 AI agents monitors financial markets, builds a shared knowledge base, and delivers insights via Telegram. An admin-only web dashboard shows the agents working in real time.

```
Users (Telegram) ──→ Telegram Bot ──→ Manager Agent ──→ [agent pipeline] ──→ Reply via Telegram
Admin             ──→ Web Dashboard (read-only polling, 3s interval)
```

### The 9 Agents

| Agent | Model | Role |
|---|---|---|
| Manager | Claude Sonnet | Entry point, intent classification, orchestration |
| Watchdog | GPT-4o-mini | Scheduled price/news scan, alert creation |
| Screener | GPT-4o-mini | Sector scan beyond watchlist, persists results |
| Researcher | GPT-4o | Data collection via MCP tools, no synthesis |
| Analyst | Claude Sonnet | Synthesis, thesis, devil's advocate, comparison |
| Technician | GPT-4o | Technical analysis (RSI/MACD/Bollinger/SMA) |
| Bookkeeper | GPT-4o-mini | Sole KB writer, contradiction detection |
| Reporter | llama-3.2-8b (local) | Format + Telegram delivery |
| Trader | GPT-4o-mini | Create trade tickets (Saxo Bank target, mock for PoC) |

### The 6 MCP Servers

| Server | Port | Data source |
|---|---|---|
| market-data-mcp | 3001 | Finnhub + FMP |
| macro-signals-mcp | 3002 | GDELT (free) + Alpha Vantage |
| news-mcp | 3003 | Finnhub + Alpha Vantage |
| rag-retrieval-mcp | 3004 | pgvector (read-only) |
| enterprise-connector-mcp | 3005 | SharePoint + Graph (mock in PoC) |
| trader-platform-mcp | 3006 | Saxo Bank OpenAPI (mock in PoC) |

### Repository Structure

```
finsight-ai-hub/
├── .specify/memory/         ← constitution.md — non-negotiable principles
├── specs/                   ← 11 feature specs (spec.md + plan.md + tasks.md per feature)
├── docs/                    ← this folder — full spec, context, references
├── config/
│   ├── runtime/             ← YAML behavioral config (committed, mounted :ro)
│   └── types/               ← Zod validation schemas
├── packages/
│   └── shared-types/        ← Zero-dep TypeScript types shared across all packages
├── apps/
│   ├── api/                 ← Hono API + agent orchestration + BullMQ workers
│   │   └── src/
│   │       ├── agents/      ← 9 agent implementations + colocated prompts
│   │       ├── routes/      ← HTTP route handlers
│   │       ├── workers/     ← BullMQ job processors
│   │       └── lib/         ← config-loader, model-router, mcp-client, db, redis
│   ├── mcp-servers/         ← 6 independent Hono MCP servers
│   ├── dashboard/           ← React admin dashboard (Mission Control)
│   └── telegram-bot/        ← Telegraf polling bot
├── prisma/                  ← schema.prisma + migrations + seed.ts
├── infra/                   ← Pulumi IaC (AWS ECS Fargate)
├── scripts/                 ← deploy.sh, logs.sh
└── docker-compose.yml       ← 12 containers
```

---

## Hardware Context

**Dev laptop (Windows 11)** — ROG Strix G18, Intel Core Ultra 9, 128GB RAM, RTX 5070 Ti 12GB
- Runs Podman Desktop (Docker-compatible socket — `docker` CLI proxies to Podman)
- Runs LM Studio serving `llama-3.2-8b-instruct` on RTX 5070 Ti at `:1234/v1`
- Development only — no production containers here

**Linux server (Ubuntu 24.04 Desktop)** — HP ENVY x360, Ryzen 5 2500U, 16GB RAM
- Runs Docker Engine + Docker Compose v2 (real Docker, not Podman)
- Always-on — hosts all 12 production containers
- Has a screen — Mission Control dashboard runs fullscreen in browser here
- Connected to dev laptop via Gigabit Ethernet LAN
- Also accessible from outside via OpenVPN on router

---

## Key Environment Variables

All secrets live in `.env` (never committed). All behavioural config lives in `config/runtime/*.yaml`.

Required secrets:
```bash
ANTHROPIC_API_KEY          # Claude Sonnet for Manager + Analyst
OPENAI_API_KEY             # GPT-4o/mini for most agents + embeddings
AZURE_OPENAI_API_KEY       # Enterprise fallback for Claude tasks
AZURE_OPENAI_ENDPOINT
AZURE_OPENAI_DEPLOYMENT=gpt4o-prod
LM_STUDIO_BASE_URL         # http://LAN_IP:1234 — dev laptop LAN IP
FINNHUB_API_KEY            # 60 req/min free tier
FMP_API_KEY                # 250 req/day free tier
ALPHA_VANTAGE_API_KEY      # 25 req/day free tier
LANGSMITH_API_KEY
LANGSMITH_PROJECT=finsight-ai-hub
TELEGRAM_BOT_TOKEN
TELEGRAM_ADMIN_HANDLE      # @yourtelegramhandle — used by seed script
DATABASE_URL               # postgresql://postgres:postgres@postgres:5432/finsight
REDIS_URL                  # redis://redis:6379
JWT_SECRET                 # 64+ random characters
ADMIN_EMAIL=admin@finsight.local
ADMIN_PASSWORD
SAXO_CLIENT_ID             # Only needed when trader.yaml: platform == "saxo"
SAXO_CLIENT_SECRET
SAXO_REDIRECT_URI
```

---

## Demo Overview

15 minutes, 5 scenes. Admin dashboard open fullscreen on Linux server screen. Developer holds phone with Telegram.

| Scene | What happens | Requirements demonstrated |
|---|---|---|
| 1 (2 min) | Dashboard at rest, 9 agent cards, model names visible, open agents.yaml | Multi-model routing, Everything-as-Code |
| 2 (4 min) | `/compare NVDA AMD` → parallel Researchers → pipeline visible → LangSmith | Parallel agent dispatch, MCP tools, observability |
| 3 (3 min) | `/devil NVDA` → contradiction detected → KB history shows 5 snapshots | RAG, living KB, contradiction detection |
| 4 (3 min) | Show MCP manifests, trigger Screener, `/screener show last` | MCP architecture, event-driven, Telegram |
| 5 (3 min) | `/pattern NVDA 3w` → TA reply → `/trade NVDA buy 10` → `/approve` → Pulumi IaC | Technician, trade lifecycle, IaC |

---

## Pre-Demo Checklist

- [x] Repository created and specs committed
- [x] Feature specs created (`specs/001–011`, all `spec.md` complete)
- [ ] `plan.md` created for each spec (use `/plan NNN-feature-name`)
- [ ] Self-hosted GitHub Actions runner installed on Linux server
- [ ] `.env` file created on Linux server with all required secrets
- [ ] Telegram bot created via @BotFather, token added to `.env`
- [ ] Finnhub, FMP, Alpha Vantage API keys obtained (all free tiers)
- [ ] LangSmith project `finsight-ai-hub` created
- [ ] LM Studio installed on dev laptop, `llama-3.2-8b-instruct` model loaded
- [ ] Docker Engine installed on Linux server
- [ ] Podman Desktop installed on dev laptop

---

## Document Versions

| Document | Version | Notes |
|---|---|---|
| `CASE.md` | 4.4 | Full specification — primary reference |
| `CONTEXT.md` | 1.1 | Environment + decisions — primary reference |
| `SPECKIT.md` | 1.0 | Original 14-spec implementation briefs — reference for plan.md authors |
| `dashboard-reference.html` | — | Renderable UI reference |
| `POSITION.md` | — | Original job description (unchanged) |
| `SETUP.md` | — | Hardware/software list (unchanged) |
| `TASK.md` | — | Original brief (unchanged) |

---

*All questions about **what to build** → `CASE.md`. All questions about **why and how** → `CONTEXT.md`. All questions about **implementing a specific feature** → `specs/NNN-feature-name/`.*
