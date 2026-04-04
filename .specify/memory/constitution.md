# FinSight AI Hub — Constitution

## Project Purpose

FinSight AI Hub is a **personal Python-first market intelligence hub** running on a dedicated Linux
laptop. It has two genuine, equally weighted purposes:

1. **Deep Python learning platform** — every architectural decision MUST use enterprise-grade Python
   tooling that appears in real AI engineering job descriptions (LangGraph, FastAPI, SQLAlchemy,
   Celery, OpenBB, LangChain, Pydantic, Dash).
2. **Real personal tool** — the developer and friends actively use it for market monitoring,
   research, and decision support.

This is not a portfolio demo. It is not targeting any specific job application. Architectural
decisions are justified by learning value and real-world utility — not by external requirements.

## Core Principles

### I. Everything-as-Code

All behavioral configuration — models, thresholds, prompts, schedules, scoring weights — lives in
version-controlled YAML files (`config/runtime/*.yaml`), validated by Pydantic v2 Settings at
startup. Secrets live **only** in `.env` (never committed). If a parameter affects agent behavior,
it MUST be configurable without code changes.

### II. Agent Boundaries (NON-NEGOTIABLE)

Each of the 9 agents has a **sole responsibility** that does not overlap with any other agent's
domain. Violations create debugging nightmares and break observability.

| Rule | Description |
|---|---|
| No cross-synthesis | Researcher collects data — it never interprets. Analyst interprets — it never fetches. |
| Single KB writer | Only Bookkeeper writes to the Knowledge Base (pgvector). All other agents read via `rag-retrieval-mcp`. |
| No autonomous trades | No trade execution of any kind in MVP. Decision support only. |
| Reporter formats only | Reporter never analyses. It receives structured output and formats it for Telegram or Dashboard delivery. |
| Manager never reasons about content | Manager classifies intent, routes to specialists, and composes results. It does not generate investment analysis. |
| Screener focuses on candidate generation | Screener produces ranked candidates from configured rules/signals only; it does not execute trades. |
| Trader remains decision support only | Trader proposes trade setups under guardrails; no autonomous execution. |
| Technician stays technical | Technician examines price/volume/technical behavior only. It does not produce investment advice. |

**The 9 agents**: Manager, Watchdog, Researcher, Analyst, Technician, Trader, Screener,
Bookkeeper/Librarian, Reporter.

### III. MCP Server Independence

Each of the 3 MCP servers is a self-contained FastMCP microservice with:
- Its own health endpoint (`GET /health`)
- Its own tool manifest (FastMCP auto-generated)
- Its own cache layer (Redis-backed, TTLs from `mcp.yaml`)
- No direct imports from agents or API code

**The 3 MCP servers**:
- `market-data-mcp` — stocks, ETFs, fundamentals, options (OpenBB Platform SDK backed)
- `news-macro-mcp` — news, sentiment, GDELT macro signals (Finnhub + GDELT backed)
- `rag-retrieval-mcp` — pgvector semantic search, document retrieval (LangChain Python backed)

MCP servers expose tools. Agents consume them via the MCP client. This boundary is **strict** —
no shortcuts.

### IV. Cost Observability

Every LLM call MUST record `tokens_in`, `tokens_out`, `cost_usd`, `provider`, `model`,
`duration_ms` in an `AgentRun` record linked to its `Mission`. The system must always be able to
answer: "How much did this mission cost? Which provider? How many tokens?"

Cost is computed deterministically from `pricing.yaml` — not estimated, not approximated.

### V. Fail-Safe Defaults

- Config validation failure → `sys.exit(1)` with descriptive Pydantic error path (never start
  with invalid config)
- MCP server unreachable at startup → fail-fast (never start with missing tools)
- Agent returns malformed output → retry once, then fail the mission (never silently swallow bad
  output)
- Unknown model in `pricing.yaml` → cost = $0.00 with warning log (never block on missing pricing)
- LM Studio unavailable → fallback to cloud provider per `agents.yaml` (never let local model
  unavailability block agents)

### VI. Test-First Where Practical

- Unit tests for all agent output validation (typed Pydantic output schemas)
- Unit tests for config loading, pricing computation, and threshold logic
- Integration tests for DB writes (Bookkeeper KB pipeline)
- Mocked external APIs (Finnhub, GDELT, Alpha Vantage, OpenBB) via `respx` — tests MUST pass
  without network access, without Docker, without a running database
- E2E test for the full mission pipeline (operator query → mission complete → KB entry created)

All tests run with `pytest`. Async tests use `pytest-asyncio`.

### VII. Simplicity Over Cleverness

- **FastAPI** over Flask/Django (async-native, auto OpenAPI docs, best DX for AI APIs)
- **LangGraph** for agent orchestration — explicit supervisor graph, stateful, inspectable.
  Never use ad-hoc prompt chaining or unstructured loops.
- **LangChain Python** used narrowly: document chunking (`RecursiveCharacterTextSplitter`),
  embedding abstraction (`OpenAIEmbeddings`), retrieval chains. Never for agent orchestration —
  that is LangGraph's job.
- **Celery + Redis** over custom schedulers (battle-tested, enterprise-standard, appears in every
  Python job description)
- **SQLAlchemy 2.x async** over raw SQL or active-record ORMs (type-safe, migration-friendly
  via Alembic)
- No WebSocket complexity — Dash dashboard polls, Telegram bot uses long-polling
- No streaming to Telegram — wait for full completion, then deliver

## Architectural Constraints

### Technology Stack (Locked)

| Layer | Technology | Rationale |
|---|---|---|
| Runtime | Python 3.13 + mypy strict | Learning goal; enterprise standard for AI engineering |
| API Framework | FastAPI | Async-native, auto OpenAPI, dominant in Python API job descriptions |
| ORM | SQLAlchemy 2.x async + Alembic + pgvector | Type-safe, async, industry-standard migrations + vector search |
| Queue | Celery + Redis 7 | Enterprise standard Python queue; ubiquitous in job descriptions |
| Agent Orchestration | LangGraph Python | Stateful graphs, supervisor pattern, production-grade multi-agent |
| Finance Data | OpenBB Platform SDK | Unified Python API for stocks, ETFs, fundamentals, options, news |
| RAG Pipeline | LangChain Python + pgvector | Primary LangChain runtime; document chunking + retrieval chains |
| Observability | LangSmith (Python) + structlog | Full LLM trace + structured JSON logs |
| Bot | python-telegram-bot v20 async | Mature async SDK; voice messages → Whisper API transcription |
| Dashboard | Dash (Plotly) | Enterprise-standard Python dashboard; touchscreen-ready ops console |
| IaC | Pulumi Python | Python-native IaC |
| Container | Docker (prod server), Podman (dev laptop) | OCI-compatible, same compose files |
| Config Validation | Pydantic v2 Settings + YAML | Industry standard Python config; startup validation |
| Monorepo | uv workspaces | Modern Python dependency management |
| Testing | pytest + respx + pytest-asyncio | Universal Python test stack |

### Deployment Topology

- **Dev Laptop (Windows 11 / Podman):** Development, testing, LM Studio (local model inference)
- **Linux Server (Ubuntu 24.04 / Docker):** Always-on production stack + operator dashboard display
- **Deploy path:** `scripts/deploy.sh` — rsync source + SSH into server + `docker compose up -d`
- **~10 containers** total: API, agent-worker, Celery beat, 3 MCP servers, Dash dashboard,
  telegram-bot, postgres, redis

### Security Constraints

- JWT access tokens stored in memory only (NOT browser storage)
- Refresh tokens in httpOnly cookies
- All admin routes behind `require_role("admin")` dependency
- Telegram users authenticated by matching `telegram_handle` against DB
- Config mounted read-only (`:ro`) in Docker containers
- `.env` never committed, never baked into images
- No trade execution of any kind — operator decision support only

## Development Workflow

### Spec-Driven Development

Every feature follows the SpecKit lifecycle:
1. **Spec** (`spec.md`) — User stories, acceptance scenarios, requirements
2. **Plan** (`plan.md`) — Technical design, file list, key decisions
3. **Tasks** (`tasks.md`) — Actionable implementation checklist

No implementation begins without a reviewed spec. No plan is written without a finalized spec.

### Build Sequence

Features are implemented in strict dependency order. Each feature's spec is self-contained — it
includes all context needed for implementation without requiring the reader to have read all
preceding specs.

### Code Quality Gates

- `uv run mypy --strict` — zero errors (strict Python type checking, no untyped `Any`)
- `uv run ruff check` — zero warnings (Python linter)
- `uv run pytest` — all tests pass (offline, no Docker required)
- Every function has explicit return type annotations
- Every public class/function has a docstring describing its purpose
- No hardcoded model names, thresholds, or API keys in source code

## Governance

This constitution supersedes informal preferences. All implementation decisions must be justifiable
against these principles. If a spec violates the constitution, the spec must be amended — not the
constitution.

Exceptions require explicit documentation in the relevant `plan.md` with rationale.

### Amendment Procedure

1. Propose the change with rationale in a PR description
2. Identify which principles are affected and whether the bump is MAJOR/MINOR/PATCH
3. Update `CONSTITUTION_VERSION` and `LAST_AMENDED_DATE`
4. Propagate to AGENTS.md, specs/README.md, and any affected plan.md files

### Versioning Policy

- **MAJOR**: Backward incompatible — stack replacement, principle removal, agent team changes
- **MINOR**: New principle or section added; material guidance expansion
- **PATCH**: Clarifications, wording, typo fixes

## Reference Documents

When implementing any feature, agents MUST read these documents in order before writing any code
or plans:

| Document | Purpose | When to read |
|---|---|---|
| `specs/README.md` | Feature catalogue, build order, dependency graph | Always — before any spec or plan work |
| `docs/STACK.md` | Technology stack decisions with full rationale for every choice | Always — explains *why* each technology was chosen and what was rejected |
| `docs/CONTEXT.md` | Hardware topology, environment constraints, key architectural decisions | Always — contains constraints affecting every implementation choice |
| The specific `specs/NNN-feature-name/spec.md` | User stories and acceptance criteria for the current feature | Always during plan and implementation |
| The specific `specs/NNN-feature-name/plan.md` | Technical design and file list for the current feature | Always during implementation |

**Version**: 2.0.0 | **Ratified**: 2026-03-28 | **Last Amended**: 2026-04-02
