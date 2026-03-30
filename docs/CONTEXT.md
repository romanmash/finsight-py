# CONTEXT.md — FinSight AI Hub
### Developer Environment, Design Decisions, and Implementation Context

**Purpose:** This document gives any implementation AI agent (Codex, Claude Code, etc.) the complete picture of the developer's environment, toolchain, constraints, and the reasoning behind every key architectural decision. Read this alongside CASE.md. CASE.md answers *what to build*. This document answers *why* and *in what environment*.

**Position application context:** FinSight is built primarily as a portfolio demonstration for a specific AI engineer freelance position. The position's stated requirements cover: multi-provider LLM integration (Anthropic + OpenAI + Azure), RAG with pgvector, multi-agent orchestration via Vercel AI SDK, MCP server architecture, internal enterprise connectors (Graph/SharePoint), event-driven patterns with BullMQ, LangSmith observability, Hono, Prisma, Docker/AWS, and Everything-as-Code. FinSight implements every one of these in a coherent domain (fintech market intelligence) rather than as isolated toy examples. The secondary purpose is a real tool the developer and friends will use. Both purposes are genuine — this is not a throwaway demo.

---

## 1. Hardware

### Dev Laptop — Windows 11

| Component | Detail |
|---|---|
| Machine | ASUS ROG Strix G18 |
| OS | Windows 11 |
| CPU | Intel Core Ultra 9 |
| RAM | 128 GB |
| GPU | NVIDIA RTX 5070 Ti, 12 GB VRAM |
| Role | TypeScript development, local container testing, LM Studio inference |

**Container runtime on dev laptop:** Podman Desktop. The `docker` CLI is proxied to Podman via a Docker-compatible socket. All `docker compose` commands work transparently. Do not assume Docker daemon — it is Podman underneath. When writing scripts that run locally on the dev laptop, use `docker` CLI which is the proxy. When writing scripts that SSH into the server, use `docker` CLI directly on the server side, which is real Docker Engine.

**LM Studio on dev laptop:** Serves `llama-3.2-8b-instruct` (and potentially other models) over an OpenAI-compatible API at `:1234`. This fits comfortably in 12 GB VRAM. The Linux server's `agent-worker` calls this over the LAN. The LM Studio URL is `http://LAN_IP:1234/v1` — the LAN IP is set in `.env: LM_STUDIO_BASE_URL`. If LM Studio is down or unreachable, Reporter falls back to GPT-4o-mini automatically (probed on startup, re-probed every 5 min).

---

### Server — Ubuntu 24.04 Desktop

| Component | Detail |
|---|---|
| Machine | HP ENVY x360 (2018 convertible) |
| OS | Ubuntu 24.04 Desktop (not Server — has a GUI) |
| CPU | AMD Ryzen 5 2500U |
| RAM | 16 GB |
| GPU | None (Radeon Vega integrated — not used for inference) |
| Role | Always-on production stack, CI runner, mission control display |

**Container runtime on server:** Docker Engine + Docker Compose v2 (plain `docker` and `docker compose` commands). No Podman. No Docker Desktop.

**Ubuntu Desktop matters:** The server has a physical screen and runs a desktop environment. The Mission Control dashboard opens fullscreen in a browser on this screen. This is not a headless server — it is a hybrid: always-on server that also acts as a display terminal for the dashboard.

**Network:** Both machines are on the same Gigabit Ethernet LAN. There is also an OpenVPN server on the router — the dev laptop can connect to the home network from outside and access the Linux server as if local.

---

## 2. Development Workflow

### Day-to-Day

1. Write TypeScript on the Windows laptop (VS Code or Cursor)
2. Test locally using Podman containers if needed (simple unit tests run without containers)
3. `git push` to a `feature/*` branch on GitHub
4. GitHub Actions CI triggers on the self-hosted runner (see §3)
5. CI runs: `pnpm -r typecheck` → `pnpm -r lint` → `pnpm -r test` → `pnpm -r test:integration`
6. PR to `develop` → CI passes → merge
7. PR `develop` → `main` → CI + automatic deploy

### Fast Deploy (skip GitHub)

`scripts/deploy.sh` on the dev laptop:
```bash
rsync -av --exclude=node_modules --exclude=.git \
  ./config/ ./docker-compose.yml ./scripts/ \
  SERVER_USER@SERVER_IP:/home/SERVER_USER/finsight/
ssh SERVER_USER@SERVER_IP "cd finsight && docker compose pull && docker compose up -d"
```

This is for rapid iteration — no CI wait. Used during active development.

### Viewing Logs

`scripts/logs.sh SERVICE_NAME` — SSHes into the server and tails logs for the named container.

---

## 3. GitHub Actions — Self-Hosted Runner

### Why Self-Hosted

GitHub's cloud runners have no network path to a home server with no public IP. The self-hosted runner is a background process on the Linux server that *polls* GitHub for jobs. No inbound ports needed.

### Setup (one-time on Linux server)

```bash
mkdir ~/actions-runner && cd ~/actions-runner
curl -o actions-runner-linux-x64.tar.gz -L \
  https://github.com/actions/runner/releases/latest/download/actions-runner-linux-x64-2.x.x.tar.gz
tar xzf actions-runner-linux-x64.tar.gz
./config.sh --url https://github.com/YOUR_USERNAME/finsight-ai-hub --token YOUR_REGISTRATION_TOKEN
sudo ./svc.sh install
sudo ./svc.sh start
```

Runner label: `self-hosted`. All workflow jobs use `runs-on: self-hosted` so GitHub cloud runners are never used.

### Secrets

All secrets live in GitHub repository secrets (Settings → Secrets → Actions). The runner injects them as environment variables during workflow execution. The `.env` file on the server is created once manually and never committed. The deploy step in CI writes a fresh `.env` from GitHub Secrets before running `docker compose up`.

---

## 4. Container Architecture

### The 12 Containers

| Container | Port | Runtime | Notes |
|---|---|---|---|
| `hono-api` | 3000 | Docker/server | Main API — routes, auth, admin, chat |
| `agent-worker` | — | Docker/server | BullMQ consumers — all scheduled and event-driven agent jobs |
| `market-data-mcp` | 3001 | Docker/server | Finnhub + FMP |
| `macro-signals-mcp` | 3002 | Docker/server | GDELT + Alpha Vantage |
| `news-mcp` | 3003 | Docker/server | Finnhub news + Alpha Vantage sentiment |
| `rag-retrieval-mcp` | 3004 | Docker/server | pgvector hybrid search |
| `enterprise-connector-mcp` | 3005 | Docker/server | Mock Graph/SharePoint |
| `trader-platform-mcp` | 3006 | Docker/server | Mock/Saxo Bank broker |
| `postgres` | 5432 | Docker/server | PostgreSQL 16 + pgvector |
| `redis` | 6379 | Docker/server | BullMQ + MCP cache |
| `frontend` | 4000 | Docker/server | nginx serving React admin dashboard |
| `telegram-bot` | — | Docker/server | Telegraf long-polling bot |

**Separation of `hono-api` and `agent-worker`:** Both run the same TypeScript codebase but with different entry points. `hono-api` starts the HTTP server. `agent-worker` starts only the BullMQ consumers and schedulers. This split means a scheduled job never blocks an HTTP request and vice versa. They share the same database and Redis.

**nginx routing on server port 80:**
- `/` → proxied to `frontend:4000` (React SPA)
- `/api/*` → proxied to `hono-api:3000`
- Dashboard is accessed via browser at `http://SERVER_IP/` or `http://SERVER_IP:4000/` directly

### Agent State Tracking (Dashboard Live Updates)

The admin dashboard shows each agent's live state (active/queued/idle/error). This is implemented via Redis:

- When an agent starts: writes `agent:state:{agentName}` → `{ state: "active", currentTask, currentMissionId, startedAt }`
- When an agent queues: writes `state: "queued"` with reason
- When an agent completes: writes `state: "idle"`, `lastActiveAt`, `lastActivitySummary`
- When an agent errors: writes `state: "error"`, `errorMessage`
- All writes use a short TTL (e.g. 10 minutes) so stale state doesn't persist across restarts

The `GET /api/admin/status` handler reads all 9 Redis keys in a single `MGET` (fast, in-memory), then aggregates today's `AgentRun` costs from Postgres (one query, cached for 30s). This gives the dashboard near-real-time agent state without expensive DB polling on every 3-second tick.

All containers receive `config/runtime/` as a read-only volume mount:
```yaml
volumes:
  - ./config/runtime:/app/config/runtime:ro
```

This means editing a YAML file on the server and restarting a container picks up the new values immediately. No image rebuild, no push.

---

## 5. User Roles and Access

| Role | Who | Dashboard | Telegram | Can create tickets |
|---|---|---|---|---|
| `admin` | The developer (you) | ✅ Full access | ✅ All commands | ✅ |
| `analyst` | Trusted friends (testers) | ❌ | ✅ All commands | ✅ |
| `viewer` | (future) read-only observers | ❌ | ✅ Read-only commands | ❌ |

**Friend clients (analyst role):** A small group of trusted friends who use FinSight to help test and debug. They have their own `User` records in the DB with `role: "analyst"` and their Telegram handles registered. They get morning briefs, can query agents, build portfolios, and create trade tickets. They cannot touch the dashboard or admin endpoints. The admin creates their accounts via the dashboard or directly in the seed script.

**No self-registration.** All accounts are admin-created. The `POST /admin/users` endpoint requires admin JWT. Unknown Telegram handles receive `"⛔ Access denied."` and are silently dropped.

**Telegram handle matching:** Every incoming Telegram message is validated against `user.telegramHandle` in the DB before any processing. This is the authentication boundary for the bot.

---

## 6. Model Configuration — Full Rationale

Every agent has per-agent model parameters in `agents.yaml`. No model names or parameters are hardcoded in TypeScript. The Zod schema validates the YAML at startup.

### Why These Temperature Choices

| Agent | Temperature | Why |
|---|---|---|
| Watchdog | 0.1 | Threshold comparisons and alert creation. Near-determinism required. |
| Bookkeeper | 0.1 | Outputs structured JSON for contradiction detection and KB writes. Near-determinism avoids malformed output. |
| Trader | 0.1 | Trade rationale should be predictable and professional. Financial decisions need consistency. |
| Manager | 0.2 | Routing decisions should be consistent but handle edge cases. Slight flexibility avoids rigid misclassification. |
| Screener | 0.2 | Sector scan scoring has some subjectivity — slight variation is fine. |
| Researcher | 0.2 | Data collection is systematic but needs flexibility in tool selection and query formation. |
| Technician | 0.2 | Indicator interpretation should be consistent but allow nuance in pattern commentary. |
| Analyst (standard) | 0.3 | Synthesis needs some reasoning variation while remaining grounded. Not robotic, not creative. |
| Analyst (devil_advocate) | 0.7 | Contrarian analysis needs creative, unexpected angles. This override is applied at runtime when mode == "devil_advocate". |
| Reporter | 0.5 | Formatting prose benefits from variation — daily briefs should not read identically every morning. |

### Why These maxTokens Choices

| Agent | maxTokens | Why |
|---|---|---|
| Researcher | 8192 | Collects large structured payloads from multiple MCP tools. Must fit fundamentals + OHLCV + news + macro + KB context in one output. |
| Analyst | 4096 | Thesis synthesis can be long, especially comparison mode across 3 tickers. |
| Reporter | 4096 | Daily briefs can be long when covering 6 tickers. |
| Manager | 2048 | Routing decisions are short. KB fast-path responses are moderate. |
| Watchdog | 2048 | Scan results are structured and brief. |
| Screener | 2048 | 3 sector finds with reasoning. |
| Technician | 2048 | Indicator interpretation + pattern commentary. |
| Bookkeeper | 1024 | Outputs only JSON contradiction assessment. Very short. |
| Trader | 1024 | 3-sentence rationale + ticket data. Short. |

### Model Provider Rationale

| Provider | Why used |
|---|---|
| Anthropic / Claude Sonnet | Best-in-class for deep reasoning (Manager, Analyst). The system's most important decisions go here. |
| OpenAI / GPT-4o | Strong at structured data collection and technical analysis (Researcher, Technician). Good cost/performance for these tasks. |
| OpenAI / GPT-4o-mini | Fast, cheap, sufficient for structured/routine tasks (Watchdog, Screener, Bookkeeper, Trader). |
| Azure OpenAI | Enterprise fallback for Anthropic tasks. Identical model capability, different availability zone. Demonstrates enterprise integration. |
| LM Studio (local) | Reporter only. Formatting tasks don't need frontier reasoning. Running locally on RTX 5070 Ti is free and fast. Demonstrates local model integration for the position demo. |

---

## 7. Saxo Bank Integration — Context

### Current State (PoC)
`trader.yaml: platform: mock`

The trader-platform-mcp returns realistic simulated responses. The tool interface mirrors Saxo Bank's API structure (instrument codes, order types, account keys) so the mock is not arbitrary — it's a faithful simulation. When the time comes to go live, only the handler bodies in `mcp-servers/trader-platform/src/tools/place-order.ts` change.

### Production Path (Saxo Bank)
`trader.yaml: platform: saxo`

Saxo Bank uses OAuth 2.0 PKCE. The flow:
1. Admin completes OAuth dance once (redirect URL hits `/auth/saxo/callback` on hono-api)
2. Tokens stored securely (not in DB — in a secrets manager or `.env` at runtime)
3. `get_account_info()` tool fetches the `AccountKey` for the target trading account
4. `place_order()` posts to `POST /trade/v2/orders` with the AccountKey

**Sandbox:** `https://gateway.saxobank.com/sim/openapi` — register at developer.saxo.com, create a SIM application, get client ID and secret.

**The Trader agent never knows which mode is active.** It calls `trader_platform_mcp.place_order(...)` identically in both modes. The MCP server handles the branching.

---

## 8. Key Architectural Decisions and Why

### Why Telegram for users, not a web UI

A web UI for users would require auth flows, a user-facing dashboard, a chat interface with SSE streaming, session management, and frontend components for portfolio, watchlist, KB search, and trade approval. That's a week of work on its own that adds no demo value for the position requirements.

Telegram gives users a fully functional bidirectional interface with zero frontend work. Commands, responses, alerts, trade tickets — all in a familiar mobile app the testers already have. The evaluator sees this as a deliberate product decision, not a shortcut.

### Why an admin dashboard instead of embedding admin in the user UI

The admin dashboard serves one person (you). Its job is making the agent architecture *visible* during a demo. Showing the evaluator 9 agent cards updating in real time — with models, costs, tool calls, and mission flows — is the most powerful thing you can do in 15 minutes. Mixing this with a user-facing interface would dilute both.

### Why 9 agents instead of fewer

Each agent has a different LLM role, different model requirements, and different trust boundaries. The separation is not arbitrary:
- Researcher uses no LLM synthesis — it's pure data collection. If it synthesised, you'd lose the ability to reuse its output across different Analyst modes.
- Analyst uses no external tools — if it called APIs, its synthesis would be entangled with data freshness concerns.
- Bookkeeper is the sole KB writer — if multiple agents wrote to the KB, contradiction detection would require distributed consensus. Having one writer makes the audit trail clean.
- Reporter uses the local model — its job is formatting, not reasoning. Spending frontier model tokens on formatting is waste.

Every separation solves a specific problem.

### Why MCP servers instead of direct API calls in agents

Three reasons:
1. **Demo value:** The position explicitly requires MCP servers. Six independent Hono services with `/mcp/tools` manifests is a concrete demonstration of the architecture, not an abstraction.
2. **Caching:** Each MCP server has its own Redis cache layer. Quotes are cached for 60 seconds. Fundamentals for 1 hour. This prevents hitting Finnhub's 60 req/min limit during parallel Researcher dispatches.
3. **Replaceability:** Swapping a data source means writing a new MCP server. The enterprise connector demo is the clearest example — mock today, real Graph SDK tomorrow, zero agent code changes.

### Why Vercel AI SDK for agent orchestration, and LangChain for the RAG pipeline

The two frameworks serve different layers and are not mutually exclusive.

**Vercel AI SDK** handles all agent orchestration:
- `generateText` with `tool()` bindings — clean, typed, provider-agnostic
- Anthropic, OpenAI, Azure all work with the same interface
- `streamText` for internal pipeline streaming
- The `tool()` dispatch pattern makes Manager's routing fully visible in LangSmith traces without custom instrumentation

**LangChain** handles the RAG document pipeline:
- `RecursiveCharacterTextSplitter` in Bookkeeper for chunking analyst outputs before embedding
- `OpenAIEmbeddings` (via `@langchain/openai`) as the embedding abstraction — swappable to Azure or other providers via config without changing Bookkeeper code
- Retrieval chain internals in `rag-retrieval-mcp` for the hybrid BM25 + cosine search pipeline

**Why not LangGraph for orchestration:** The agent pipeline is already clean with `tool()` dispatch. LangGraph would add stateful graph complexity, extra dependencies, and a new mental model for what is a straightforward sequential-with-branching flow. The position does not require LangGraph specifically.

This split — Vercel AI SDK on the agent/app layer, LangChain on the backend document processing layer — is a standard pattern for production TypeScript AI platforms and demonstrates deliberate framework selection rather than picking one and using it for everything.

### Why BullMQ instead of cron jobs or setInterval

Scheduled jobs (Watchdog every 30 min, Screener at 07:00) need:
- Persistence across restarts (a cron job dies when the process dies)
- Retry with backoff on failure
- A queue depth visible in the dashboard
- Concurrency control (exactly 1 Watchdog scan at a time)

BullMQ backed by Redis gives all of this. The dashboard shows queue depths directly.

### Why separate `agent-worker` container from `hono-api`

A long-running BullMQ job (e.g. daily brief processing 6 tickers through the full pipeline — 45+ seconds) must not block HTTP request handling. Separating them means:
- A slow daily brief doesn't add latency to a Telegram command arriving at the same moment
- The worker can be scaled independently in production
- Crash isolation: a failed worker doesn't take down the API

### Why pgvector + BM25 hybrid search instead of pure vector search

Pure vector (cosine similarity) is excellent at semantic recall but weak at exact term matching. A query for "NVDA Q3 earnings" should surface entries that contain those exact words highly ranked, even if semantically similar entries exist. BM25 handles this. The RRF (Reciprocal Rank Fusion) merge of both result sets gives the best of both without tuning weights manually.

### Why the Bookkeeper runs before the Trader in trade_request flow

The Bookkeeper's job is to persist the Analyst's thesis to the KB *before* Trader uses it. If Trader creates a ticket referencing the analysis, that analysis should already be in the KB so the ticket's `basedOnMissions` field points to a persisted KB entry. This is also why Bookkeeper's write happens before Trader's ticket creation — the thesis snapshot is the foundation the ticket rationale references.

### Why config is YAML, not JSON or TypeScript

- **YAML is human-readable and hand-editable on the server** — you or a friend can SSH in, `nano config/runtime/agents.yaml`, change one model name, and restart one container. No TypeScript compilation, no JSON escaping issues.
- **Committed to git** — config changes are tracked, reviewable, and reversible. You can see exactly when you changed Analyst's temperature from 0.2 to 0.4.
- **Zod validation** — the YAML is validated against TypeScript types at startup. The schema is the contract. This gives the safety of typed config without the friction of recompiling TypeScript to change a value.

---

## 9. What NOT to Do — Explicit Constraints

These are constraints decided during design. Do not change them without re-examining the reasoning.

**Never let agents other than Bookkeeper write to `kb_entries` or `kb_thesis_snapshots`.** The entire contradiction detection and audit trail system depends on all writes going through Bookkeeper.

**Never put business logic in route handlers.** Routes validate input with Zod, call a use case function, return the result. Any logic that requires understanding the domain goes in `agents/` or `services/`.

**Never import Prisma client directly in agent files** (except Bookkeeper, which has an explicit exception via typed repository interface). Agents receive typed domain objects, not DB clients.

**Never hardcode model names, temperatures, or token limits in TypeScript.** All of these live in `config/runtime/agents.yaml` and are injected at runtime. The codebase should compile and start correctly even if you swap every model in the YAML.

**Never put secrets in `config/runtime/*.yaml`.** YAML files are committed to git. Secrets go in `.env` only.

**Do not use WebSockets for the admin dashboard.** The polling approach (`GET /api/admin/status` every 3 seconds) is deliberate. It's simpler, survives network interruptions, and is sufficient for the update frequency needed. Do not add socket.io or WebSocket complexity.

**Do not stream responses to Telegram.** The `telegram-bot` container calls the internal API, waits for the full agent pipeline to complete, and sends the complete reply. Streaming partial responses to Telegram would require a different Telegraf pattern and adds complexity for no user benefit (Telegram renders the full message at once anyway).

**`pattern_request` (Technician) does NOT go through Bookkeeper.** Technical analysis (RSI, MACD etc.) is not thesis material. Storing every `/pattern` call in the KB would pollute it with transient data. Only full investigations (operator_query, alert_investigation, comparison, devil_advocate, earnings_prebrief, trade_request, daily_brief) write to the KB.

---

## 10. Demo Environment Preparation

### What Must Be True Before the Demo

- Linux server is on, all 12 containers healthy
- LM Studio running on Windows laptop, `llama-3.2-8b-instruct` model loaded
- `pnpm seed` has been run — DB has admin + analyst users, NVDA thesis history, seeded Screener run, earnings alert
- Morning brief has been delivered (either 06:00 auto-run or manually triggered)
- Telegram bot responds to `/help`

### What the Evaluator Sees

The evaluator watches the Linux server's browser (or your dev laptop browser over LAN) showing the Mission Control dashboard fullscreen. You hold the phone. Every command you type on the phone causes visible activity on the dashboard within 1–3 seconds (agent cards lighting up, pipeline steps advancing, tool call spinners).

### Expected Latencies

| Operation | Expected time |
|---|---|
| `/pattern NVDA 3w` | 8–15 seconds (Technician + Reporter) |
| `/compare NVDA AMD` | 25–45 seconds (2× parallel Researcher + Analyst + Bookkeeper + Reporter) |
| `/devil NVDA` | 20–35 seconds (Researcher + Analyst devil mode + Bookkeeper + Reporter) |
| `/trade NVDA buy 10` | 15–25 seconds (Researcher + Analyst + Bookkeeper + Trader + Reporter) |
| `/screener show last` | < 1 second (DB read only, no agent dispatch) |

These are wall-clock times including LLM API latency. They will vary based on provider load.

---

## 11. Open Questions / Future Work

These are items that were discussed but explicitly deferred from the PoC scope. A fresh AI agent should not implement these without explicit instruction.

| Item | Status | Notes |
|---|---|---|
| Saxo Bank live trading | Deferred | Mock is sufficient for PoC. Real OAuth + order flow = post-PoC |
| Microsoft Graph SDK (real) | Deferred | enterprise-connector-mcp uses mock data. Swap handler bodies post-PoC |
| User self-registration | Deferred | Admin-created accounts only. Self-registration requires email verification etc. |
| Frontend unit tests | Deferred | Dashboard components are simple polling views. Manual verification for PoC |
| Rate limiting per MCP server | Deferred | Redis-backed rate limiter exists in hono-api. MCP servers don't have per-client rate limiting yet |
| Multi-tenant KB | Not planned | All KB entries are shared across users. Per-user KB isolation is not needed for this use case |
| Portfolio P&L tracking | Not planned | Portfolio stores holdings + quantities, not cost basis or P&L. Out of scope |
| Streaming responses in Telegram | Not planned | See §9 constraints. Not beneficial for Telegram's rendering model |

---

## 12. File Reference

| File | Purpose |
|---|---|
| `CASE.md` | Full product specification — architecture, agents, schemas, build plan, demo script |
| `CONTEXT.md` | This file — environment, toolchain, decisions, constraints |
| `docs/dashboard-reference.html` | Self-contained renderable HTML showing the exact Mission Control dashboard visual target |

---

*End of CONTEXT.md — FinSight AI Hub*
