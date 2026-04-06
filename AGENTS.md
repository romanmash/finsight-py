# AGENTS.md

Instructions for AI coding assistants working on the FinSight AI Hub repository.

## Project Overview

FinSight AI Hub is a **Python-first** multi-agent fintech market intelligence platform built with
FastAPI, LangGraph, SQLAlchemy, Celery, OpenBB, and Dash. 9 specialist agents collaborate through
a LangGraph supervisor graph. Data flows through 3 independent FastMCP tool servers. Users interact
via Telegram (text + voice); the operator monitors via a Dash dashboard on the local Linux laptop.

**This is a Spec-Driven Development project.** All implementation is governed by feature specs in
`specs/NNN-feature-name/`.

## Read Order (mandatory before any implementation)

1. `.specify/memory/constitution.md` — non-negotiable principles and quality gates
2. `specs/README.md` — feature catalogue with build order and dependencies
3. The specific `specs/NNN-feature-name/spec.md` for your current task
4. The specific `specs/NNN-feature-name/plan.md` for implementation details
5. `docs/CONTEXT.md` — architectural decisions and environment constraints

## Architecture

```
packages/shared/               → shared Pydantic models and domain types (zero external deps)
apps/api-service/                      → FastAPI app + all 9 agents + Celery workers
apps/api-service/src/api/agents/       → 9 agent implementations + colocated prompts (*.prompt.py)
apps/api-service/src/api/agents/shared/→ Shared prompt fragments
apps/api-service/src/api/graphs/       → LangGraph supervisor graph + node definitions
apps/api-service/src/api/mcp/          → MCP client (tool registration + routing)
apps/api-service/src/api/routes/       → FastAPI routers (auth, admin, chat, missions, kb, etc.)
apps/api-service/src/api/lib/          → Singletons: db.py, redis.py, queues.py, config.py, pricing.py
apps/api-service/src/api/workers/      → Celery workers: watchdog, screener, brief, earnings, alert
apps/mcp-servers/              → 3 independent FastMCP servers
apps/mcp-servers/market-data/  → OpenBB-backed: stocks, ETFs, fundamentals, options
apps/mcp-servers/news-macro/   → Finnhub + GDELT: news, sentiment, macro signals
apps/mcp-servers/rag-retrieval/→ LangChain + pgvector: semantic search, document retrieval
apps/dashboard/                → Dash (Plotly) operator console
apps/telegram-bot/             → python-telegram-bot v20 async + Whisper voice transcription
config/runtime/                → YAML config files (Everything-as-Code)
config/schemas/                → Pydantic v2 schemas for YAML validation
infra/                         → Pulumi Python IaC
scripts/                       → deploy.sh, logs.sh
```

<!-- MANUAL ADDITIONS START -->

## Rules (NON-NEGOTIABLE)

1. **Read the constitution first** — `.specify/memory/constitution.md` defines project principles,
   agent boundaries, and quality gates. Every implementation decision must be justifiable against it.
2. **Spec scope is strict** — each feature spec lists exactly which files to create. Do NOT
   implement code from other specs. Do NOT add features not in the current spec.
3. **Everything-as-Code** — all behavioral configuration lives in `config/runtime/*.yaml`,
   validated by Pydantic v2 at startup. No hardcoded model names, thresholds, or schedules.
4. **No hardcoded values or secrets** — no magic numbers for business behavior and no hardcoded
   credentials/tokens/passwords/API keys anywhere in code, tests, docs, or examples.
   Put behavior in `config/runtime/*.yaml` and secrets in `.env` only.
5. **Python strict typing** — `mypy --strict` must pass with zero errors. No untyped `Any`.
   Explicit return types on every function. All domain types from `packages/shared/`.
6. **Agent boundaries** — each agent has a sole responsibility. Do not let Researcher synthesise,
   Analyst fetch, Reporter analyse, or Bookkeeper format. See constitution.
7. **Test offline** — all tests must pass without network access, without LM Studio, without
   Docker. Mock external HTTP with `respx`.
8. **Conventional Commits** — `<type>(<scope>): <description>`.
   Types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`.
   Scopes: `shared`, `config`, `api`, `mcp`, `agents`, `graph`, `kb`, `dashboard`, `telegram`,
   `db`, `infra`, `spec`.
9. **Fail-fast config** — if any YAML file is invalid at startup, call `sys.exit(1)` with the
   exact Pydantic error path. Never start with bad config.
10. **Cost tracking** — every LLM call must record `tokens_in`, `tokens_out`, `cost_usd`,
    `provider`, `model`, `duration_ms` in an `AgentRun` record.
11. **Colocated prompts** — agent prompts live at `apps/api-service/src/api/agents/x_agent.prompt.py`
    alongside `apps/api-service/src/api/agents/x_agent.py`. Shared prompts in `apps/api-service/src/api/agents/shared/`.

## Development Workflow

1. **Read** the constitution: `.specify/memory/constitution.md`
2. **Read** the feature catalogue: `specs/README.md`
3. **Read** the target spec: `specs/NNN-feature-name/spec.md`
4. **Read** the implementation plan: `specs/NNN-feature-name/plan.md`
5. **Implement** only the files listed in the plan
6. **Test** with `uv run pytest` (must pass offline)
7. **Typecheck** with `uv run mypy --strict` (zero errors)
8. **Lint** with `uv run ruff check` (zero warnings)
9. **Commit** using conventional commit format

### Codex/Sandbox Test Note

- Project default pytest capture is `--capture=sys` (set in `pyproject.toml`) to avoid fd-capture temp-file issues in WSL2/Codex.
- In WSL2/Codex environments where pytest hangs, use `danger-full-access` mode.
- Repository default is `.codex/config.toml` with `sandbox_mode = "danger-full-access"` and `approval_policy = "on-request"`.
- If your tooling ignores repo-local config, mirror the same settings in `~/.codex/config.toml`.
- After changing sandbox mode, restart VS Code/Codex.
- Use normal `uv run pytest` in this mode.

## SpecKit Skill Workflow

SpecKit skills (`/speckit.plan`, `/speckit.tasks`, `/speckit.implement`) use the current **git
branch name** to locate the active feature directory (`specs/<branch>/`). When working on `main`,
set the `SPECIFY_FEATURE` environment variable first.

**Set before invoking any SpecKit skill:**

```bash
export SPECIFY_FEATURE=001-python-foundation-config   # matches the specs/ directory name
```

**Full workflow for each feature (spec.md exists, need plan + tasks + implement):**

```bash
export SPECIFY_FEATURE=002-async-data-layer   # adjust per feature
/speckit.plan                           # generates plan.md, research.md, data-model.md, contracts/
/speckit.tasks                          # generates tasks.md
/speckit.implement                      # executes all tasks
```

**After `/speckit.plan` runs**: It will call `update-agent-context.sh` which updates this file
(AGENTS.md) with new technology context from the plan. This is expected — the script preserves
manually-written sections between the MANUAL ADDITIONS markers.

## Key Commands

```bash
uv sync                          # Install all workspace dependencies
uv run mypy --strict             # Type check (zero errors required)
uv run ruff check                # Lint (zero warnings required)
uv run pytest                    # Run all tests (offline, no Docker required)
uv run alembic upgrade head      # Apply database migrations
uv run python -m api.seeds.seed  # Load demo data
docker compose up -d             # Start all containers (server)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d  # Dev mode
docker compose --profile debug up -d debug-mcp  # Start debug MCP server only
bash scripts/docker-auto.sh compose up -d  # Portable Docker invocation (docker or docker.exe)
```

## Debug MCP Setup

- Start debug server with compose profile: `docker compose --profile debug up -d debug-mcp`
- Verify server health: `curl http://localhost:8010/health`
- Codex MCP config lives in `.vscode/mcp.json` (`debug-infra` HTTP + `debug-browser` stdio docker)
- Claude MCP config lives in `.claude/settings.json` under `mcpServers`
- `debug-browser` uses Docker network `finsight_default` (from `COMPOSE_PROJECT_NAME=finsight` + default network)
- If the project name differs locally, verify with `docker network ls` and update both MCP config files

## WSL2 Docker Interop

- Use `bash scripts/docker-auto.sh ...` in automation to support both Linux Docker CLI and Windows Docker bridge.
- Resolution order is deterministic: `docker` first, fallback to `docker.exe`.
- Example checks:
  - `bash scripts/docker-auto.sh version`
  - `bash scripts/docker-auto.sh compose ps`
  - `bash scripts/docker-auto.sh network ls`
- MCP browser configs already use this wrapper, so agents can run browser MCP from WSL2 without manual command rewrites.

## Key Files

| File | Purpose | Modify? |
|---|---|---|
| `.specify/memory/constitution.md` | Project principles + quality gates | Only with documented rationale |
| `specs/NNN-*/spec.md` | Feature PRDs — user stories, acceptance criteria | Reference only during implementation |
| `specs/NNN-*/plan.md` | Feature SDDs — technical design, file list | Reference only during implementation |
| `docs/STACK.md` | Technology stack decisions with rationale for every choice | Reference — explains why each framework was chosen |
| `docs/CONTEXT.md` | Architecture decisions and environment constraints | Reference only |
| `config/runtime/*.yaml` | Runtime configuration (Everything-as-Code) | Update values as needed |
| `CLAUDE.md` | Claude Code entry point — imports `@AGENTS.md` | Do not edit directly |
| `.codex/hooks/python-quality-check.*` | Codex-local Python quality gate hooks (`ruff`, `mypy`, `pytest`) | Keep aligned with constitution quality gates |

## Technology Stack (Locked)

| Layer | Technology | Why |
|---|---|---|
| Runtime | Python 3.13 + mypy strict | Learning goal; enterprise AI engineering standard |
| Monorepo | uv workspaces | Modern Python dep management; fast |
| API | FastAPI | Async-native, auto OpenAPI, dominant Python API framework |
| ORM | SQLAlchemy 2.x async + Alembic + pgvector | Type-safe, async, industry-standard migrations |
| Queue | Celery + Redis 7 | Enterprise standard Python queue |
| Agent Orchestration | LangGraph Python | Stateful supervisor graph; production multi-agent |
| Finance Data | OpenBB Platform SDK | Unified Python API for stocks, ETFs, macro, news |
| RAG Pipeline | LangChain Python + pgvector | Primary LangChain runtime; chunking + retrieval |
| Observability | LangSmith + structlog | LLM traces + structured JSON logs |
| Bot | python-telegram-bot v20 async | Mature async SDK; voice via Whisper API |
| Dashboard | Dash (Plotly) | Enterprise Python dashboard; touchscreen operator console |
| IaC | Pulumi Python | Python-native IaC |
| Container | Docker (prod server) / Podman (dev laptop) | OCI-compatible |

## Safety

- `.env` is gitignored — secrets NEVER in source control
- `config/runtime/` is mounted `:ro` in containers — immutable at runtime
- JWT access tokens in memory only — NOT browser storage
- Refresh tokens in httpOnly cookies
- Admin routes behind `require_role("admin")` FastAPI dependency
- No trade execution of any kind — operator decision support only
- Any unknown model in `pricing.yaml` → cost = $0.00 with warning (never block)

<!-- MANUAL ADDITIONS END -->
