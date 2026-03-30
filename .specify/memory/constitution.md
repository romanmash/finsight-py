# FinSight AI Hub — Constitution

## Core Principles

### I. Everything-as-Code

All behavioral configuration — models, thresholds, prompts, schedules, scoring weights — lives in version-controlled files (`config/runtime/*.yaml`), validated by Zod schemas at startup. Secrets live **only** in `.env` (never committed). If a parameter affects agent behavior, it MUST be configurable without code changes.

### II. Agent Boundaries (NON-NEGOTIABLE)

Each of the 9 agents has a **sole responsibility** that does not overlap with any other agent's domain. Violations create debugging nightmares and break observability.

| Rule | Description |
|---|---|
| No cross-synthesis | Researcher collects data — it never interprets. Analyst interprets — it never fetches. |
| Single KB writer | Only Bookkeeper writes to the Knowledge Base (pgvector). All other agents read via `rag-retrieval-mcp`. |
| No autonomous trades | Trader creates tickets — it NEVER executes. Only explicit human approval (via Telegram `/approve`) triggers execution. |
| Reporter formats only | Reporter never analyses. It receives structured output and formats it for Telegram delivery. |
| Manager never reasons about content | Manager classifies intent and routes. It does not generate investment analysis. |

### III. MCP Server Independence

Each of the 6 MCP servers is a self-contained Hono microservice with:
- Its own health endpoint (`GET /health`)
- Its own tool manifest (`GET /mcp/tools`)
- Its own invocation endpoint (`POST /mcp/invoke`)
- Its own cache layer (Redis-backed, TTLs from `mcp.yaml`)
- No direct imports from agents or API code

MCP servers expose tools. Agents consume them via the MCP Client. This boundary is **strict** — no shortcuts.

### IV. Cost Observability

Every LLM call MUST record `tokensIn`, `tokensOut`, `costUsd`, `provider`, `model`, `durationMs` in an `AgentRun` record linked to its `Mission`. The system must always be able to answer: "How much did this mission cost? Which provider? How many tokens?"

Cost is computed deterministically from `pricing.yaml` — not estimated, not approximated.

### V. Fail-Safe Defaults

- Config validation failure → `process.exit(1)` with descriptive Zod error (never start with invalid config)
- MCP server unreachable at startup → fail-fast (never start with missing tools)
- Agent returns malformed JSON → retry once, then fail the mission (never silently swallow bad output)
- Unknown model in `pricing.yaml` → cost = $0 with warning log (never block on missing pricing)
- LM Studio unavailable → fallback to cloud provider per `agents.yaml` (never let local model unavailability block agents)

### VI. Test-First Where Practical

- Unit tests for all agent output validation (typed output schemas)
- Unit tests for config loading, pricing computation, and threshold logic
- Integration tests for DB writes (Bookkeeper KB pipeline, trade ticket lifecycle)
- Mocked external APIs (Finnhub, FMP, GDELT, Alpha Vantage) via `msw` — tests run without network
- E2E test for the full mission pipeline (operator_query: chat → mission complete → KB entry created)

### VII. Simplicity Over Cleverness

- Hono over Express (lighter, faster, better TypeScript)
- Direct `generateText` for agent orchestration — no LangGraph, no CrewAI
- LangChain used narrowly: document chunking (`RecursiveCharacterTextSplitter`), embedding abstraction (`OpenAIEmbeddings`), and retrieval chains in the RAG layer (`rag-retrieval-mcp`, Bookkeeper). Never for agent orchestration.
- BullMQ over custom schedulers (battle-tested, Redis-backed)
- Prisma over raw SQL (type-safe, migration-friendly)
- No WebSocket complexity — Admin Dashboard polls every 3 seconds
- No streaming to Telegram — wait for full completion, then deliver

## Architectural Constraints

### Technology Stack (Locked)

| Layer | Technology | Rationale |
|---|---|---|
| Runtime | Node.js 20 LTS, TypeScript 5.x strict | Position requirement, type safety |
| API Framework | Hono | Lightweight, Web Standards, excellent DX |
| ORM | Prisma + pgvector | Type-safe, migration support, vector search |
| Queue | BullMQ + Redis 7 | Repeatable jobs, retries, dead letter |
| AI SDK | Vercel AI SDK | Multi-provider, tool() bindings, streaming |
| RAG Pipeline | LangChain JS (`@langchain/core`, `@langchain/openai`) | Document chunking, embedding abstraction, retrieval chains — RAG layer only |
| Observability | LangSmith + Pino | Full LLM trace + structured logging |
| Bot | Telegraf | Mature polling-based Telegram SDK |
| IaC | Pulumi (TypeScript) | TypeScript-native, AWS support |
| Container | Docker (prod), Podman (dev) | OCI-compatible, same compose files |

### Deployment Topology

- **Dev Laptop (Windows/Podman):** Development, testing, LM Studio
- **Linux Server (Ubuntu/Docker):** Production deployment via `scripts/deploy.sh` (rsync + ssh)
- **12 containers** total: API, agent-worker, 6 MCP servers, frontend, telegram-bot, postgres, redis

### Security Constraints

- JWT access tokens stored in memory only (NOT localStorage)
- Refresh tokens in httpOnly cookies
- All admin routes behind `roleGuard('admin')` middleware
- Telegram users authenticated by matching `telegramHandle` against DB
- Config mounted read-only (`:ro`) in Docker containers
- `.env` never committed, never baked into images

## Development Workflow

### Spec-Driven Development

Every feature follows the SpecKit lifecycle:
1. **Spec** (spec.md) — User stories, acceptance scenarios, requirements
2. **Plan** (plan.md) — Technical design, file list, key decisions
3. **Tasks** (tasks.md) — Actionable implementation checklist

No implementation begins without a reviewed spec. No plan is written without a finalized spec.

### Build Sequence

Features are implemented in strict dependency order. Each feature's spec is self-contained — it includes all context needed for implementation without requiring the reader to have read all preceding specs.

### Code Quality Gates

- `pnpm -r typecheck` — zero errors (strict TypeScript, no `any`)
- `pnpm -r lint` — zero warnings (ESLint flat config)
- `pnpm -r test` — all tests pass
- Every function has explicit return types
- Every interface has JSDoc describing its purpose

## Governance

This constitution supersedes informal preferences. All implementation decisions must be justifiable against these principles. If a spec violates the constitution, the spec must be amended — not the constitution.

Exceptions require explicit documentation in the relevant plan.md with rationale.

## Reference Documents

When implementing any feature, agents MUST read these documents in order before writing any code or plans:

| Document | Purpose | When to read |
|---|---|---|
| `specs/README.md` | Feature catalogue, build order, dependency graph | Always — before any spec or plan work |
| `docs/CONTEXT.md` | Hardware topology, environment constraints, key architectural decisions with rationale | Always — contains constraints that affect every implementation choice |
| `docs/CASE.md` | Full system specification (2000+ lines) — entities, pipelines, API contracts | When you need full detail on a component not covered by the current spec |
| `docs/SPECKIT.md` | Detailed TypeScript interfaces per component | When authoring `plan.md` files — has concrete interface definitions |
| The specific `specs/NNN-feature-name/spec.md` | User stories and acceptance criteria for the current feature | Always during plan and implementation |
| The specific `specs/NNN-feature-name/plan.md` | Technical design and file list for the current feature | Always during implementation |

**Version**: 1.1 | **Ratified**: 2026-03-28 | **Last Amended**: 2026-03-30
