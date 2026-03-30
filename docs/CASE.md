# CASE.md — FinSight AI Hub
### TypeScript PoC · Freelance Position Demo · v4.4

**Version:** 4.4  
**Status:** Ready for Spec Kit generation  
**Timeline:** ~1 week, AI-assisted (Codex / Claude Code)  
**Primary purpose:** Demonstrate every requirement of a specific AI engineer freelance position through one real, working, domain-coherent application. Every technology in §2 maps 1-to-1 to a stated requirement of that position. The platform is simultaneously a genuine, usable product and a deliberate portfolio piece.  
**Secondary purpose:** A personal market intelligence tool the developer and a small group of friends will actually use during and after the demo.

---

## 1. What FinSight Is

**Context:** FinSight is built as a PoC for a freelance AI engineer position application. The evaluator is an experienced AI/ML engineering team assessing whether the developer can design and ship a production-grade multi-agent TypeScript platform. Every technology choice in §2 maps directly to a requirement stated in the position specification. The demo (§17) is structured to make each requirement visible and tangible within 15 minutes.

A **market intelligence platform** where a team of AI agents monitors financial markets, builds a shared knowledge base, and delivers insights to users via Telegram. An admin-only web dashboard — running on the Linux server and accessible remotely — shows the agent team operating in real time, like a mission control room.

**User interaction model:**
- **Users = Telegram only.** Commands, responses, morning briefs, alerts, trade ticket approvals. No web login for users.
- **Admin = Web dashboard only.** Agent cards, mission log, system health, KB stats, cost tracking, config management. Fullscreen browser on Ubuntu Desktop, also accessible remotely via LAN/OpenVPN from dev laptop.

**Who uses FinSight:**
- **Admin (the developer)** — full system access. Dashboard + all Telegram commands. Manages users, config, and system health.
- **Friend clients (informal testers)** — a small group of trusted friends who are granted `analyst` role. They use Telegram commands, have their own portfolios and watchlists, receive morning briefs, and help find bugs during development. They cannot access the dashboard. This makes the multi-user feature real and testable rather than theoretical.

No public registration. All accounts are created by the admin.

**The one-sentence pitch:** *"An internal AI platform where specialist agents collaborate to monitor markets, remember what they've learned, and alert users via Telegram — with a mission control dashboard that makes the agent team visible in real time."*

**What it is not:** A trading bot, a generic chatbot, a no-code tool.

---

## 2. Position Requirements Coverage

| Requirement | How FinSight covers it |
|---|---|
| OpenAI + Anthropic + multi-model | Manager + Analyst: Claude Sonnet; Researcher + Technician: GPT-4o; Watchdog + Screener + Bookkeeper + Trader: GPT-4o-mini; Reporter: local LM Studio (fallback: GPT-4o-mini); Azure OpenAI: enterprise fallback for Claude tasks |
| RAG + embeddings + pgvector | Bookkeeper embeds every KB entry via LangChain `OpenAIEmbeddings` into pgvector; rag-retrieval-mcp serves hybrid semantic + BM25 search via LangChain retrieval chain; `/history` command proves longitudinal memory |
| Agent workflows — Vercel AI SDK + LangChain | Vercel AI SDK: 9-agent orchestration, tool() bindings, parallel Researcher dispatch, confidence-gated routing. LangChain: document chunking, embedding abstraction, RAG retrieval chain |
| MCP servers — pluggable tools | **6 independent Hono MCP servers**; agents register tools at startup from `mcp.yaml`; new data source = new server, zero agent code changes |
| Internal systems (Graph, SharePoint) | `enterprise-connector-mcp` — SharePoint doc search + Graph email search (realistic mock in PoC; real Graph SDK in production, agent code unchanged) |
| Event-driven patterns + retries | BullMQ named queues for all scheduled/triggered jobs; retry policy from `agents.yaml` |
| Observability | LangSmith trace per mission; Pino structured JSON logging with request IDs; every AgentRun records model, provider, tokens, duration, cost |
| TypeScript / Node.js | 100% TypeScript across all services |
| Hono | All API services and all 6 MCP servers |
| Prisma + PostgreSQL + pgvector | ORM + relational data + vector similarity search |
| Docker + AWS + Azure | Docker Compose (local) + Pulumi IaC (AWS ECS Fargate + RDS + ElastiCache) + Azure OpenAI Service |
| Vercel AI SDK | `generateText` + `tool()` bindings for all agent orchestration; parallel dispatch via `Promise.all`; agent tool-call steps recorded per AgentRun and surfaced in the mission pipeline on the admin dashboard |
| LangChain JS | RAG pipeline only — `RecursiveCharacterTextSplitter` (chunking), `OpenAIEmbeddings` (embedding abstraction, Azure-swappable via config), custom retrieval chain in `rag-retrieval-mcp`. Never used for agent orchestration. |
| Auth + multi-user | JWT auth, admin-managed accounts, per-user portfolios and watchlists, per-user brief delivery |
| Everything-as-Code | YAML runtime config + Zod validation + Pulumi IaC + Prisma migrations + prompts-as-code + seed script |

---

## 3. Agent Team

### Design Rules

- **Manager** routes and orchestrates. It never analyses, never writes to KB.
- **Watchdog** monitors prices and news on a schedule. It never analyses.
- **Screener** scans sectors beyond the watchlist on a schedule. It never analyses.
- **Researcher** collects data via MCP tools only. No LLM synthesis — returns structured JSON.
- **Analyst** synthesises and reasons. It calls no external tools — receives all input from Manager.
- **Technician** performs technical analysis on OHLCV data. Completely separate from Analyst.
- **Bookkeeper** is the sole KB writer. It detects contradictions before every write. No other agent writes to KB.
- **Reporter** formats and delivers output only. It never analyses.
- **Trader** creates trade tickets for human approval only. It never executes anything.

### Agent Table

| # | Agent | Model (from agents.yaml) | Trigger | Sole Responsibility |
|---|---|---|---|---|
| 1 | **Manager** | anthropic / claude-sonnet | Telegram · BullMQ alerts · Scheduler | Intent classification, routing, portfolio context injection, KB fast-path |
| 2 | **Watchdog** | openai / gpt-4o-mini | BullMQ every 30 min · manual | Price + news scan; earnings calendar; alert creation |
| 3 | **Screener** | openai / gpt-4o-mini | BullMQ weekdays 07:00 · `POST /api/screener/trigger` (manual) | Sector scan beyond watchlist; persist results to `screener_runs` |
| 4 | **Researcher** | openai / gpt-4o | Dispatched by Manager | Collect data via 6 MCP tool servers; return typed JSON; no synthesis |
| 5 | **Analyst** | anthropic / claude-sonnet | Dispatched by Manager | Synthesise Researcher output into thesis; Devil's Advocate mode; comparison mode |
| 6 | **Technician** | openai / gpt-4o | Dispatched by Manager (`pattern_request`; optionally during `alert_investigation` if price/pattern alert) | RSI, MACD, Bollinger, SMA, pattern interpretation from OHLCV |
| 7 | **Bookkeeper** | openai / gpt-4o-mini | After Analyst in every mission type; after Technician in full investigations (not standalone pattern_request) | Contradiction detection; thesis snapshot; pgvector upsert |
| 8 | **Reporter** | local-lm → gpt-4o-mini | End of every mission; daily brief cron | Format + push to Telegram; write DailyBrief record |
| 9 | **Trader** | openai / gpt-4o-mini | Explicit request only | Create trade ticket via trader-platform-mcp; never executes |

### Agent Hierarchy Diagram

```mermaid
graph TD
    T([Telegram / BullMQ]) --> M[Manager<br/>claude-sonnet]

    M -->|schedule / signal| WD[Watchdog<br/>gpt-4o-mini]
    M -->|schedule / manual| SC[Screener<br/>gpt-4o-mini]
    M -->|dispatch| RE[Researcher<br/>gpt-4o]
    M -->|dispatch + Researcher output| AN[Analyst<br/>claude-sonnet]
    M -->|dispatch| TE[Technician<br/>gpt-4o]
    M -->|explicit only, after Analyst| TR[Trader<br/>gpt-4o-mini]

    AN -->|AnalystOutput| BK[Bookkeeper<br/>gpt-4o-mini]
    TE -->|TechnicianOutput| BK
    BK -->|mission complete| RP[Reporter<br/>local-lm]

    WD -->|alerts + signals| M
    SC -->|screener finds| M
    RE -->|ResearchOutput to Manager| M

    RP -->|push| TG([Telegram users])
    TR -->|ticket created| RP

    style M fill:#EEEDFE,stroke:#534AB7,color:#26215C
    style AN fill:#EEEDFE,stroke:#534AB7,color:#26215C
    style RE fill:#E6F1FB,stroke:#185FA5,color:#042C53
    style TE fill:#E6F1FB,stroke:#185FA5,color:#042C53
    style WD fill:#EAF3DE,stroke:#3B6D11,color:#173404
    style SC fill:#EAF3DE,stroke:#3B6D11,color:#173404
    style BK fill:#FAEEDA,stroke:#854F0B,color:#412402
    style RP fill:#E1F5EE,stroke:#0F6E56,color:#04342C
    style TR fill:#FAECE7,stroke:#993C1D,color:#4A1B0C
```

### Mission Flow by Intent Type

```mermaid
flowchart LR
    OQ([operator_query]) --> KB{KB fresh?}
    KB -->|yes — fast path| RP
    KB -->|no| RE --> AN --> BK --> RP

    DA([devil_advocate]) --> RE2[Researcher] --> ADA[Analyst<br/>devil mode] --> BK2[Bookkeeper] --> RP

    CM([comparison]) --> PAR["Researcher × N<br/>(parallel)"] --> AN2[Analyst<br/>comparison] --> BK3[Bookkeeper] --> RP

    PR([pattern_request]) --> TE[Technician] --> RP

    AI([alert_investigation]) --> RE3[Researcher] --> AN3[Analyst] --> BK4[Bookkeeper] --> RP

    EP([earnings_prebrief]) --> RE4["Researcher<br/>(earnings focus)"] --> AN4[Analyst] --> BK5[Bookkeeper] --> RP

    TRQ([trade_request]) --> RE5[Researcher] --> AN5[Analyst] --> BK6[Bookkeeper] --> TR[Trader] --> RP

    DB([daily_brief]) --> RE6["Researcher<br/>(all tickers)"] --> AN6[Analyst] --> BK7[Bookkeeper] --> RP

    RP([Reporter → Telegram])

    style RP fill:#E1F5EE,stroke:#0F6E56,color:#04342C
    style KB fill:#FAEEDA,stroke:#854F0B,color:#412402
```

---

## 4. UI vs Telegram — Clear Division

### Rule: Users Never Touch the Web UI

**Users = Telegram only.** All user interaction — queries, briefs, alerts, portfolio, trade tickets — happens through Telegram. No web login for users.

**Admin = Web dashboard only.** The dashboard is a mission control surface, not a product interface.

---

### Web Dashboard — Admin Mission Control

Runs as a React SPA served by nginx on the Linux server (:4000). Opened fullscreen on Ubuntu Desktop. Accessible remotely via LAN or OpenVPN. Single JWT admin login.

**Layout: 4 columns**

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│  FinSight · Mission Control     Today: $0.84/$5.00   [pills]   admin · 3s refresh │
├──────────────┬─────────────────────────────┬───────────────────┬───────────────────┤
│  COL 1       │  COL 2                      │  COL 3            │  COL 4            │
│  Agent Floor │  Active Mission + Log       │  System Health    │  Spend + Admin    │
│  (fixed      │  (widest — most dynamic)    │  + KB + Alerts    │  Tools            │
│   280px)     │                             │                   │                   │
│              │  [mission pipeline]         │  [health grid]    │  [spend table]    │
│  [9 compact  │  > Manager ✓               │  postgres ●       │  Total: $0.84     │
│   agent      │  > Researcher ● (active)   │  redis    ●       │  Anthropic:$0.60  │
│   cards]     │    get_ohlcv ✓             │  market-d ●       │  OpenAI: $0.23    │
│              │    get_fundamentals ✓      │  news-mcp ●       │  LM Studio:$0.00  │
│  Each card:  │    get_ticker_news ↻       │  ...              │                   │
│  name|model  │    sharepoint... (pending) │                   │  [admin buttons]  │
│  task desc   │  > Analyst (queued)        │  KB: 47 entries   │  + Create user    │
│  status|cost │  > Bookkeeper (pending)    │  Contradictions:2 │  Manage users     │
│              │  > Reporter (pending)      │  Alerts: 1        │  Reload config    │
│              │                             │  Tickets: 1       │  Trigger Screener │
│              │  [mission log last 10]      │                   │                   │
└──────────────┴─────────────────────────────┴───────────────────┴───────────────────┘
```

**Agent card layout (single row, compact):**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Manager            │  Routing NVDA query          │  ● active              │
│  claude-sonnet·anth │  operator_query in progress  │  1,240 tok · $0.019    │
└─────────────────────────────────────────────────────────────────────────────┘
```
Left border accent: green = active, amber = queued, invisible = idle, red = error.

**Agent card states:**
- `● active` — green left border — currently running, shows current task
- `◑ queued` — amber left border — waiting in dispatch queue
- `○ idle` — no accent — shows last activity + timestamp
- `✗ error` — red left border — last run failed, shows error

**Active mission pipeline** (Col 2, top): vertical step list. When an agent step is active, its MCP tool calls appear as sub-items with individual state indicators (done = filled dot, running = CSS spinner, pending = empty dot). This is the most visually impressive element during a live demo.

**Telegram → Agent pipeline flow:** The `telegram-bot` container receives user commands, calls `POST /api/chat` on the hono-api, waits for the full agent pipeline to complete (using `generateText`, not `streamText` — no streaming client exists), then calls the Telegram API to deliver the reply. The pipeline is asynchronous internally but appears synchronous to the user. Expected latency: 5–20 seconds per query depending on agent chain length.

**Auto-refresh:** Single `GET /api/admin/status` poll every 3 seconds. See §5.4 for response shape.

### Dashboard Visual Reference

The companion file `docs/dashboard-reference.html` is a self-contained, immediately renderable HTML implementation reference for the React frontend (§13 frontend components). Open it in any browser to see the exact agreed layout with live CSS spinner animations. The React implementation must produce an identical result.

**Key implementation details captured in the reference:**
- 4-column CSS grid: `280px 1fr 200px 180px`
- Agent cards: 3-zone single-row CSS grid — `84px 1fr auto` — name+model | task description | status+cost
- Left border accent: `border-left: 2.5px solid` — green=active, amber=queued, transparent=idle, red=error
- Active/queued cards: subtle tinted background (`#f7fffc` green, `#fffdf7` amber)
- Pipeline step node (active): `box-shadow: 0 0 0 2.5px var(--green-ring)` — pulsing ring effect
- Spinning tool call: pure CSS `border-top-color: transparent; animation: spin 0.8s linear infinite`
- Mission log: LangSmith links per completed mission entry
- Budget bar: CSS width percentage from `todayTotalUsd / dailyBudgetUsd`
- No WebSockets. All state from `GET /api/admin/status` polled every 3 seconds via `useAdminStatus` hook
- JWT stored in-memory only (not localStorage). `AuthContext` handles silent token refresh

**Every position requirement is visible in the dashboard:**

| Requirement | Dashboard location |
|---|---|
| Multi-model routing | Every agent card: model name + provider |
| Agent orchestration | Active mission pipeline (Col 2) — live step progression |
| Observability | LangSmith link per mission log entry; token + cost per card |
| Event-driven | Queue depths + alert count in Col 3 |
| RAG | KB entry count + contradiction count in Col 3 |
| LM Studio local model | Reporter card shows "local-lm · $0.000" |
| Azure fallback | Shows in agent card when azure provider is active |
| MCP architecture | Demo via terminal + browser `/mcp/tools` in Scene 4 |
| Cost tracking | Col 4 spend breakdown per provider; daily budget progress |

---

### Telegram — All User Interaction

The Telegram bot (`telegram-bot` container, Telegraf polling) is the complete product interface for users.

**Full command set:**

| Command | What it does |
|---|---|
| `/brief` | Today's daily brief for this user |
| `/pattern TICKER [Nw]` | Technician runs TA, replies in thread (default: 2 weeks) |
| `/screener show last` | Last Screener run from DB — no new scan |
| `/trade TICKER buy\|sell QTY` | Creates trade ticket, pending approval |
| `/approve TICKET_ID` | Approves ticket → mock execution confirmed |
| `/reject TICKET_ID [reason]` | Rejects ticket |
| `/thesis TICKER` | Current KB thesis for this ticker |
| `/history TICKER` | Last 5 thesis snapshots with change summaries |
| `/alert` | Unacknowledged alerts for this user |
| `/ack ALERT_ID` | Acknowledge alert |
| `/watchlist` | Watchlist + live prices |
| `/add TICKER [portfolio\|interesting]` | Add to watchlist (default: interesting) |
| `/portfolio` | Holdings + quantities |
| `/compare TICKER1 TICKER2 [TICKER3]` | Parallel Researcher dispatch → comparison |
| `/devil TICKER` | Analyst in Devil's Advocate mode |
| `/help` | Full command list |

**Live in demo:** `/compare`, `/devil`, `/screener show last`, `/pattern`, `/trade`, `/approve` — 6 commands, ~6 min total.

**Security:** Sender's Telegram handle must match `user.telegramHandle` in DB. Unknown handles: `"⛔ Access denied."` Rate limit: `telegram.yaml: rateLimitPerUserPerMinute`.

**Proactive push (no command):**
- 06:00 daily: morning brief → every active user's handle
- Immediately on alert creation: price spike, thesis contradiction, earnings approaching
- Trade ticket created/approved/rejected: outcome pushed to the requesting user

---

## 5. Architecture

### 5.1 System Architecture

```mermaid
graph TB
    subgraph CLIENT["Client Layer"]
        DASH["Admin Dashboard<br/>React SPA · nginx :4000<br/>JWT auth · 3s polling"]
        TG_APP["Telegram App<br/>User mobile interface<br/>(phone)"]
    end

    subgraph API["Hono API Server :3000"]
        AUTH["Auth routes<br/>/auth/*"]
        ADMIN_R["Admin routes<br/>/admin/*"]
        ADMINST["GET /api/admin/status"]
        APP_R["App routes<br/>/api/chat · /api/kb · etc."]
    end

    subgraph BOT["telegram-bot container"]
        TGH["Telegraf bot<br/>Polls Telegram API<br/>Calls /api/chat internally<br/>Buffers full response → sends"]
    end

    subgraph AGENTS["Agent Orchestration (Vercel AI SDK)"]
        MGR["Manager"]
        REST_AG["Watchdog · Screener · Researcher<br/>Analyst · Technician · Bookkeeper<br/>Reporter · Trader"]
    end

    subgraph MCP["MCP Server Layer (6 Hono services)"]
        MCP1["market-data :3001"]
        MCP2["macro-signals :3002"]
        MCP3["news :3003"]
        MCP4["rag-retrieval :3004"]
        MCP5["enterprise :3005"]
        MCP6["trader-platform :3006"]
    end

    subgraph DATA["Data + Queue Layer"]
        PG["PostgreSQL 16<br/>+ pgvector"]
        RD["Redis 7<br/>BullMQ queues + MCP cache"]
    end

    subgraph EXT["External Services"]
        LLM["Anthropic · OpenAI · Azure OAI<br/>LM Studio (LAN)"]
        FIN["Finnhub · FMP · GDELT<br/>Alpha Vantage"]
        OBS["LangSmith"]
        TG_API["Telegram Bot API"]
    end

    TG_APP <-->|sends commands| TG_API
    TG_API <-->|Telegraf long-poll| TGH
    TGH -->|POST /api/chat| APP_R
    REST_AG -->|push reply| TGH
    TGH -->|sendMessage| TG_API
    DASH -->|REST + 3s poll| ADMINST
    DASH -->|admin actions| ADMIN_R
    DASH -->|auth| AUTH
    API --> AGENTS
    AGENTS <-->|MCP tool calls| MCP
    MCP <-->|HTTP| FIN
    AGENTS <-->|LLM calls| LLM
    AGENTS <-->|traces| OBS
    AGENTS <-->|DB| PG
    AGENTS <-->|queues| RD
    MCP4 <-->|read-only| PG
    MCP4 <-->|cache| RD
    MCP6 <-->|tickets| PG
    MCP1 <-->|cache| RD
    MCP2 <-->|cache| RD
    MCP3 <-->|cache| RD
```

### 5.2 Deployment Topology

```mermaid
graph LR
    subgraph DEV["Windows Dev Laptop (ROG Strix G18)"]
        IDE["TypeScript dev · VS Code / Cursor"]
        PDM["Podman Desktop<br/>Docker-compatible socket<br/>local dev containers"]
        LMS["LM Studio<br/>RTX 5070 Ti · 12GB VRAM<br/>:1234/v1 on LAN"]
        GIT["git push"]
    end

    subgraph GH["GitHub"]
        REPO["Repository"]
        CI["Actions CI<br/>typecheck · lint · test"]
    end

    subgraph SERVER["Linux Server (HP ENVY x360, Ubuntu 24.04)"]
        RUNNER["Self-hosted<br/>Actions runner"]
        subgraph DC["Docker Engine · Docker Compose (12 containers)"]
            API2["hono-api :3000"]
            WRK["agent-worker"]
            MCPS["6 MCP servers :3001–3006"]
            PG2["postgres :5432"]
            RD2["redis :6379"]
            FE["frontend :4000"]
            BOT["telegram-bot"]
        end
        NX["nginx :80"]
    end

    GIT --> REPO
    REPO --> CI
    CI --> RUNNER
    RUNNER -->|docker compose up| DC
    NX --> FE
    NX --> API2
    LMS -->|"http://LAN_IP:1234/v1"| WRK
```

**Container runtime distinction:**
- **Dev laptop (Windows 11):** Podman Desktop. The `docker` CLI is proxied to Podman via a Docker-compatible socket. Used for local development and testing only. No production containers run here.
- **Linux server (Ubuntu 24.04):** Docker Engine + Docker Compose v2. All production containers run here. The self-hosted GitHub Actions runner executes `docker compose` directly.
- **`scripts/deploy.sh`** runs on the dev laptop — it uses `rsync` + `ssh` to copy files and execute `docker compose` commands remotely on the server. No Podman involved on the server side.

### 5.3 Multi-Model Routing

```mermaid
graph LR
    subgraph PROVIDERS["Providers (all from agents.yaml)"]
        ANT["anthropic<br/>claude-sonnet-4-20250514"]
        OAI["openai<br/>gpt-4o"]
        MINI["openai<br/>gpt-4o-mini"]
        AZ["azure<br/>gpt-4o<br/>(fallback)"]
        LM["lmstudio<br/>llama-3.2-8b<br/>(local, free)"]
        FB["gpt-4o-mini<br/>(LM Studio fallback)"]
    end

    MGR2["Manager"] --> ANT
    AN2["Analyst"] --> ANT
    ANT -->|unavailable| AZ

    RE2["Researcher"] --> OAI
    TE2["Technician"] --> OAI

    WD2["Watchdog"] --> MINI
    SC2["Screener"] --> MINI
    BK2["Bookkeeper"] --> MINI
    TR2["Trader"] --> MINI

    RP2["Reporter"] --> LM
    LM -->|probe fails| FB

    style ANT fill:#EEEDFE,stroke:#534AB7,color:#26215C
    style AZ fill:#E6F1FB,stroke:#185FA5,color:#042C53
    style OAI fill:#EAF3DE,stroke:#3B6D11,color:#173404
    style MINI fill:#E1F5EE,stroke:#0F6E56,color:#04342C
    style LM fill:#FAEEDA,stroke:#854F0B,color:#412402
    style FB fill:#F1EFE8,stroke:#5F5E5A,color:#2C2C2A
```

LM Studio is probed on startup and every 5 minutes (`GET {LM_STUDIO_BASE_URL}/v1/models`, timeout 2s). Result exposed at `GET /api/admin/status → localModel: "available" | "fallback"`. Dashboard shows green/amber indicator on Reporter card.

### 5.4 `GET /api/admin/status` Response Shape

This single endpoint drives the entire dashboard. Polled every 3 seconds. Admin role required.

**How agent states are populated:** Each agent, when it starts running, writes a Redis key `agent:state:{agentName}` with `{ state, currentTask, currentMissionId, startedAt }`. When it completes or errors, it updates the key and persists final stats to the `AgentRun` DB record. The `/api/admin/status` handler reads all 9 Redis keys (fast — in-memory) plus aggregates `AgentRun` costs from Postgres for today's date. This ensures the dashboard always reflects live state without polling the DB on every request.

```typescript
interface AdminStatusResponse {
  agents: Record<AgentName, {
    state: "active" | "queued" | "idle" | "error";
    currentTask: string | null;       // e.g. "Fetching NVDA data"
    currentMissionId: string | null;
    model: string;                    // actual model string in use
    provider: "anthropic" | "openai" | "azure" | "lmstudio";
    todayTokensIn: number;
    todayTokensOut: number;
    todayCostUsd: number;             // computed: tokens × pricing.yaml rates
    lastActiveAt: string | null;      // ISO timestamp
    lastActivitySummary: string | null;
    errorMessage: string | null;
  }>;

  activeMission: {
    id: string;
    type: MissionType;
    tickers: string[];
    trigger: string;
    startedAt: string;
    elapsedSeconds: number;
    steps: Array<{
      agentName: AgentName;
      state: "done" | "active" | "queued" | "pending";
      toolCalls: Array<{
        name: string;
        mcpServer: string;
        state: "done" | "running" | "pending";
      }>;
    }>;
  } | null;

  missionLog: Array<{
    id: string;
    type: MissionType;
    tickers: string[];
    status: "complete" | "failed" | "running";
    startedAt: string;
    durationSeconds: number | null;
    totalTokens: number;
    totalCostUsd: number;
    langsmithUrl: string | null;
  }>;  // last 10

  health: {
    postgres: "ok" | "error";
    redis: "ok" | "error";
    mcpServers: Record<string, "ok" | "error">;
    localModel: "available" | "fallback";
    telegramBot: "ok" | "error";
  };

  kb: {
    totalEntries: number;
    contradictionCount: number;
    lastWriteAt: string | null;
    tickersTracked: number;
  };

  queues: {
    depths: Record<string, number>;   // queue name → job count
    pendingAlerts: number;
    pendingTickets: number;
  };

  spend: {
    todayTotalUsd: number;
    byProvider: Record<string, number>;
    dailyBudgetUsd: number;           // from pricing.yaml
  };
}
```

---

## 6. Everything-as-Code

### Config Architecture — Three Layers

```mermaid
graph LR
    ENV[".env<br/>Secrets only<br/>Gitignored<br/>API keys · DB URL · JWT secret"]
    YAML["config/runtime/*.yaml<br/>All behavioral values<br/>Committed to git · No secrets<br/>Mounted :ro into containers<br/>Edit + restart = new values<br/>No rebuild"]
    ZOD["config/types/*.schema.ts<br/>Zod schemas only<br/>No values · Compiled into bundle<br/>App exits on schema failure"]

    ENV -->|"injected by Docker"| APP
    YAML -->|"volume mount"| APP
    ZOD -->|"validates YAML at startup"| APP
    APP["Running Service"]

    style ENV fill:#FCEBEB,stroke:#A32D2D,color:#501313
    style YAML fill:#EAF3DE,stroke:#3B6D11,color:#173404
    style ZOD fill:#E6F1FB,stroke:#185FA5,color:#042C53
```

**Hot-reload path:** Edit YAML on server → `POST /admin/config/reload` (or chokidar detects change) → new values active in seconds → dashboard shows diff of changed keys. No container restart needed.

**Fail-fast:** If any YAML fails Zod validation on startup, the service logs the exact failing field and exits with code 1. No silent misconfiguration.

### Runtime YAML Files (config/runtime/)

**agents.yaml** — full model parameters per agent. All fields configurable without code changes.
```yaml
agents:
  manager:
    primary:  { provider: anthropic, model: claude-sonnet-4-20250514, temperature: 0.2, maxTokens: 2048 }
    fallback: { provider: azure,     model: gpt-4o,                  temperature: 0.2, maxTokens: 2048 }

  watchdog:
    primary:  { provider: openai, model: gpt-4o-mini, temperature: 0.1, maxTokens: 2048 }

  screener:
    primary:  { provider: openai, model: gpt-4o-mini, temperature: 0.2, maxTokens: 2048 }

  researcher:
    primary:  { provider: openai, model: gpt-4o, temperature: 0.2, maxTokens: 8192 }
    # High maxTokens: Researcher collects large amounts of structured data

  analyst:
    primary:  { provider: anthropic, model: claude-sonnet-4-20250514, temperature: 0.3, maxTokens: 4096 }
    fallback: { provider: azure,     model: gpt-4o,                  temperature: 0.3, maxTokens: 4096 }
    # devil_advocate mode overrides temperature at runtime
    devilAdvocateTemperature: 0.7

  technician:
    primary:  { provider: openai, model: gpt-4o, temperature: 0.2, maxTokens: 2048 }

  bookkeeper:
    primary:  { provider: openai, model: gpt-4o-mini, temperature: 0.1, maxTokens: 1024 }
    # temperature: 0.1 — Bookkeeper outputs structured JSON only; near-determinism required

  reporter:
    primary:  { provider: lmstudio, model: llama-3.2-8b-instruct, temperature: 0.5, maxTokens: 4096 }
    fallback: { provider: openai,   model: gpt-4o-mini,            temperature: 0.5, maxTokens: 4096 }
    # Higher temperature: Reporter formats prose; some creativity is desirable

  trader:
    primary:  { provider: openai, model: gpt-4o-mini, temperature: 0.1, maxTokens: 1024 }

retries:
  maxAttempts: 3
  backoffMs: 1000
  backoffMultiplier: 2.0

confidence:
  reDispatchOnLow: true
```

*Notes on parameter choices:*
- `temperature: 0.1` for Watchdog, Bookkeeper, Trader — threshold checks, structured JSON, and financial decisions require near-determinism
- `temperature: 0.2` for Manager, Screener, Researcher, Technician — routing, scoring, collection, and analysis are systematic with slight flexibility
- `temperature: 0.3` for Analyst — synthesis needs some reasoning variation while remaining grounded
- `temperature: 0.5` for Reporter — formatting and prose benefit from slight variation
- `devilAdvocateTemperature: 0.7` — Analyst in devil_advocate mode overrides its primary temperature at runtime to produce more creative contrarian arguments
- `maxTokens: 8192` for Researcher — collects large structured data payloads across multiple MCP tools
- `maxTokens: 1024` for Bookkeeper and Trader — structured short outputs only

**pricing.yaml** — token costs per provider (used by dashboard spend calculation)
```yaml
providers:
  anthropic:
    claude-sonnet-4-20250514: { inputPer1kTokens: 0.003, outputPer1kTokens: 0.015 }
  openai:
    gpt-4o:      { inputPer1kTokens: 0.0025, outputPer1kTokens: 0.01 }
    gpt-4o-mini: { inputPer1kTokens: 0.00015, outputPer1kTokens: 0.0006 }
  azure:
    gpt-4o:      { inputPer1kTokens: 0.0025, outputPer1kTokens: 0.01 }
  lmstudio:
    "*": { inputPer1kTokens: 0, outputPer1kTokens: 0 }

dailyBudgetUsd: 5.00
alertThresholdPct: 80
```

**watchdog.yaml**
```yaml
priceAlertThresholdPct: 2.0
volumeSpikeMultiplier: 2.5
earningsPreBriefDaysAhead: 3
newsLookbackMinutes: 30
```

**screener.yaml**
```yaml
sectors: [semiconductors, ETFs, gold, energy]
minimumSignalScore: 0.6
topResultsPerRun: 3
```

**scheduler.yaml**
```yaml
watchdogScan:  { cron: "*/30 * * * *", concurrency: 1 }
screenerScan:  { cron: "0 7 * * 1-5",  concurrency: 1 }
dailyBrief:    { cron: "0 6 * * *",    concurrency: 1 }
earningsCheck: { cron: "30 7 * * 1-5", concurrency: 1 }
```

**rag.yaml**
```yaml
embeddingModel: text-embedding-3-small
embeddingDimensions: 1536
chunkSize: 512
chunkOverlap: 64
topK: 8
bm25Weight: 0.3
freshnessBoostDays: 7
```

**mcp.yaml** — server URLs + per-server cache TTLs
```yaml
servers:
  marketData:         { url: "http://market-data-mcp:3001",      timeoutMs: 5000, cache: { quoteTtlSec: 60, fundamentalsTtlSec: 3600, earningsTtlSec: 14400, ratingsTtlSec: 21600 } }
  macroSignals:       { url: "http://macro-signals-mcp:3002",    timeoutMs: 8000, cache: { gdeltTtlSec: 1800, ecoCalendarTtlSec: 14400, indicatorTtlSec: 86400 } }
  news:               { url: "http://news-mcp:3003",             timeoutMs: 5000, cache: { latestTtlSec: 300, sentimentTtlSec: 900 } }
  ragRetrieval:       { url: "http://rag-retrieval-mcp:3004",    timeoutMs: 3000 }
  enterpriseConnector:{ url: "http://enterprise-connector-mcp:3005", timeoutMs: 4000 }
  traderPlatform:     { url: "http://trader-platform-mcp:3006",  timeoutMs: 3000 }
```

**trader.yaml**
```yaml
ticketExpiryHours: 24
minConfidenceToCreateTicket: medium
maxPendingTicketsPerUser: 5
mockExecutionSlippagePct: 0.05
allowedRoles: [admin, analyst]
requireTechnicianAlignment: false

# Target broker platform
# "mock"  — PoC mode: full in-memory mock, no real orders
# "saxo"  — Production: routes approve_ticket to Saxo Bank OpenAPI
platform: mock

# Saxo Bank connection (used when platform == "saxo")
# Credentials come from .env: SAXO_CLIENT_ID, SAXO_CLIENT_SECRET, SAXO_REDIRECT_URI
# Saxo API base URL (use sim.logonvalidation.net for sandbox, live.logonvalidation.net for production)
saxo:
  apiBaseUrl: https://gateway.saxobank.com/sim/openapi
  accountKey: ""   # populated at runtime from OAuth token exchange
```

**auth.yaml**
```yaml
accessTokenExpiryMinutes: 15
refreshTokenExpiryDays: 7
bcryptRounds: 12
```

**telegram.yaml**
```yaml
rateLimitPerUserPerMinute: 10
```

**app.yaml**
```yaml
logLevel: info
featureFlags:
  devilsAdvocate: true
  traderAgent: true
  screenerAgent: true
  hotConfigReload: true
```

---

## 7. Clean Architecture

### 7.1 Layered Architecture

Dependencies flow inward only. Outer layers know about inner layers; inner layers know nothing about outer layers.

```mermaid
graph TB
    DL["Delivery Layer<br/>routes/ · telegram/ · workers/<br/>HTTP handlers · Telegram commands · BullMQ processors<br/>Knows about: Use Case layer only"]
    UC["Use Case Layer<br/>agents/ · services/<br/>Agent orchestration · mission management<br/>contradiction detection · embedding<br/>Knows about: Domain layer only"]
    DO["Domain Layer<br/>packages/shared-types/<br/>Pure TypeScript types and interfaces<br/>ResearchOutput · AnalystOutput · TradeTicket · Mission<br/>Zero framework dependencies"]
    IL["Infrastructure Layer<br/>lib/ · prisma/ · mcp-servers/<br/>Prisma · Redis · LLM providers · MCP clients · API adapters<br/>Implements interfaces from Domain layer"]

    DL --> UC
    UC --> DO
    IL --> DO

    style DL fill:#E6F1FB,stroke:#185FA5,color:#042C53
    style UC fill:#EEEDFE,stroke:#534AB7,color:#26215C
    style DO fill:#EAF3DE,stroke:#3B6D11,color:#173404
    style IL fill:#FAEEDA,stroke:#854F0B,color:#412402
```

### 7.2 Boundaries and Rules

**Agents never import route handlers.** Routes call agents; agents never call routes.

**Agents never import Prisma directly.** They receive typed domain objects. Exception: Bookkeeper uses `lib/db.ts` through a typed repository interface — this is explicit and documented.

**MCP servers are isolated services.** They share `packages/shared-types` for tool I/O types but have zero imports from `apps/api`. Independently deployable, independently testable.

**No business logic in route handlers.** Routes: validate input (Zod), call a use case function, return the result. If the route handler needs a comment explaining what it does, the logic belongs in a use case.

**Config is injected, never imported in business logic.** Agents receive typed config as a parameter. Independently testable without touching the filesystem.

**Interfaces over implementations.** Services depend on typed interfaces, not concrete Prisma/Redis/Anthropic clients. Enables clean mocking in tests.

### 7.3 Code Quality Standards

- TypeScript `"strict": true` everywhere. No `any` without explicit ESLint disable comment.
- Explicit return types on all exported functions. No inference on public API surfaces.
- All domain string literals (agent names, mission types, alert types, roles, providers) are `const` enums in `packages/shared-types`. Never raw strings in business logic.
- Error handling is explicit: re-throw, log with context, or `Result<T, E>`. No silent `catch (() => {})`.
- Functions do one thing. If the name needs "and", it should be two functions.
- Naming is unambiguous: `analyst.devil-advocate.prompt.ts`, `routes/kb.ts` handles `/api/kb/*`.

---

## 8. Testing Strategy

### 8.1 Test Pyramid

```mermaid
graph TB
    E2E["E2E Tests<br/>tests/e2e/<br/>Full stack · mocked external APIs (msw)<br/>auth flow · mission pipeline · Telegram commands<br/>Fewest tests, highest confidence"]
    INT["Integration Tests<br/>routes/__tests__/ · workers/__tests__/<br/>Real Postgres (testcontainers) · Real Redis<br/>No external API calls (msw boundary mocks)<br/>Auth flows · DB writes · BullMQ workers"]
    UNIT["Unit Tests<br/>agents/__tests__/ · lib/__tests__/ · mcp-servers/*/src/__tests__/<br/>Pure logic · Mocked I/O · Fast · Many<br/>Agent output contracts · Config loader · Model router<br/>Command parser · MCP tool handlers · Indicator math"]

    E2E --> INT --> UNIT

    style E2E fill:#FCEBEB,stroke:#A32D2D,color:#501313
    style INT fill:#FAEEDA,stroke:#854F0B,color:#412402
    style UNIT fill:#EAF3DE,stroke:#3B6D11,color:#173404
```

### 8.2 What to Test

**Agent output contracts (unit):** Each agent has at least one test per intent type. LLM and MCP calls are mocked. Verifies typed output shape, required fields, confidence field values.

**Bookkeeper contradiction detection (unit):** Known contradictory thesis pairs → `contradictionFound: true`. Known consistent pairs → `contradictionFound: false`. LLM call mocked. Tests structuring and decision logic only.

**Config loader (unit):** Valid YAML passes. Invalid YAML exits with field-level error. Hot-reload produces new values. Missing required fields fail at startup.

**Model router (unit):** LM Studio unavailable → fallback to gpt-4o-mini. Azure configured → used for Manager/Analyst fallback. All probe outcomes covered.

**Telegram command parser (unit):** `/pattern NVDA 3w` → `{ command: "pattern", ticker: "NVDA", weeks: 3 }`. Unknown sender → denied. Rate limit → error message.

**MCP tool handlers (unit):** Each handler tested with mocked API client responses. Output matches declared tool schema.

**Technician indicators (unit):** Known OHLCV input → expected RSI / MACD values. Deterministic math, no mocking needed.

**Auth flow (integration):** Login → JWT. Invalid credentials → 401. Expired token → 401 on protected route. Refresh → new access token.

**Bookkeeper DB write (integration):** Full flow — AnalystOutput in → thesis snapshot + KbEntry + embedding created in test DB → verify records.

**Trade ticket lifecycle (integration):** Create → list as pending → approve → status change + mockExecutionPrice set → reject path verified.

**BullMQ workers (integration):** Watchdog job processes, writes price snapshots, enqueues alert when threshold exceeded.

### 8.3 Tooling

```
Framework:     Vitest (TypeScript-native, pnpm workspace compatible)
HTTP mocking:  msw (Mock Service Worker — intercepts at network level)
DB containers: @testcontainers/postgresql (real Postgres in Docker for integration tests)
Assertions:    Vitest built-in + custom Zod schema matcher (toMatchSchema)
Coverage:      Vitest v8 — target: >80% Use Case layer, >60% overall
```

### 8.4 What Is Not Tested

**LLM response quality** — not tested. We test that prompt construction is correct, output is handled correctly, and typed output is produced. We do not assert on what the model said.

**Real external APIs** — not tested. Finnhub, FMP, GDELT, Alpha Vantage are mocked at the network boundary. API adapter modules have their own unit tests against mock HTTP responses.

**Frontend** — not unit-tested in PoC scope. Admin dashboard components are simple polling views. Manual verification sufficient. Post-PoC: React Testing Library for critical components.

---

## 9. GitHub Actions + Deployment Pipeline

### 9.1 CI/CD Flow

```mermaid
sequenceDiagram
    participant DEV as Dev Laptop
    participant GH as GitHub
    participant RUN as Self-hosted Runner<br/>(Linux Server)
    participant DC as Docker Compose

    DEV->>GH: git push feature/*
    GH->>RUN: trigger CI (typecheck · lint · test)
    RUN-->>GH: ✓ pass / ✗ fail

    DEV->>GH: PR: feature → develop
    GH->>RUN: trigger CI
    RUN-->>GH: ✓ pass

    DEV->>GH: PR: develop → main (merge)
    GH->>RUN: trigger CI + deploy
    RUN->>RUN: pnpm build
    RUN->>DC: prisma migrate deploy
    RUN->>DC: docker compose pull
    RUN->>DC: docker compose up -d
    RUN->>DC: health check :3000/health
    DC-->>GH: ✓ deployed
```

**Why self-hosted runner:** GitHub cloud runners have no network path to a home Linux server. The self-hosted runner is a background process on the Linux server that polls GitHub for jobs — no inbound ports needed.

### 9.2 CI/CD Workflow File

```yaml
# .github/workflows/ci.yml
name: CI / CD
on:
  push:    { branches: [main, develop] }
  pull_request: { branches: [main, develop] }

jobs:
  typecheck:
    runs-on: self-hosted
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - run: pnpm install --frozen-lockfile
      - run: pnpm -r typecheck

  lint:
    runs-on: self-hosted
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - run: pnpm install --frozen-lockfile
      - run: pnpm -r lint

  test:
    runs-on: self-hosted
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - run: pnpm install --frozen-lockfile
      - run: pnpm -r test
      - run: pnpm -r test:integration

  deploy:
    runs-on: self-hosted
    needs: [typecheck, lint, test]
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - run: pnpm install --frozen-lockfile
      - run: pnpm -r build
      - run: pnpm --filter api prisma migrate deploy
        env: { DATABASE_URL: "${{ secrets.DATABASE_URL }}" }
      - run: docker compose pull && docker compose up -d --remove-orphans
      - run: sleep 10 && curl -f http://localhost:3000/health
```

### 9.3 Branch Strategy

```
main      — protected; CI required; auto-deploys on merge
develop   — integration branch; CI runs; no auto-deploy
feature/* — development; CI runs; no auto-deploy
```

---

## 10. Agent Specifications

### 10.1 Manager

**Model:** `agents.yaml → manager`  
**Trigger:** Telegram command (via `/api/chat` called by telegram handler) · BullMQ daily-brief job · Watchdog alert pipeline  
**Tools (Vercel AI SDK `tool()` bindings):**
- `dispatchResearcher({ ticker, focusQuestions, userId })` — single ticker
- `dispatchResearcherParallel([{ ticker, focusQuestions }])` — N tickers via `Promise.all`
- `dispatchAnalyst({ researchData, existingThesis, portfolioContext?, mode })`
- `dispatchTechnician({ ticker, periodWeeks })`
- `dispatchTrader({ ticker, action, quantity, analysisData, userId })`
- `requestReporter({ missionOutput, missionType, userId })`
- `queryKb({ query, ticker?, filters? })` — calls rag-retrieval-mcp directly for fast-path

**Intent routing table:**

| Intent | Trigger | Agent chain |
|---|---|---|
| `operator_query` | Telegram message | KB fast-path → if miss: Researcher → Analyst → Bookkeeper → Reporter |
| `alert_investigation` | Watchdog signal | Researcher → Analyst → Bookkeeper → Reporter |
| `comparison` | Multiple tickers detected | dispatchResearcherParallel → Analyst(comparison) → Bookkeeper → Reporter |
| `devil_advocate` | `/devil TICKER` | Researcher → Analyst(devil mode) → Bookkeeper → Reporter |
| `pattern_request` | `/pattern TICKER Nw` | Technician → Reporter (no Analyst, no Bookkeeper) |
| `earnings_prebrief` | Watchdog earnings trigger | Researcher(earnings focus) → Analyst → Bookkeeper → Reporter |
| `trade_request` | `/trade TICKER buy\|sell QTY` | Researcher → Analyst → Bookkeeper → Trader → Reporter |
| `daily_brief` | BullMQ 06:00 | Researcher(all tickers) → Analyst → Bookkeeper → Reporter; brief-worker reads latest Watchdog snapshots + Screener results from DB to populate brief sections |

**KB fast-path:** For `operator_query`, call `rag_retrieval_mcp.get_current_thesis(ticker)`. If confidence is `"high"` and `last_updated` within 24h → respond directly, log `trigger: "kb_fast_path"`. No agent dispatch.

**Portfolio context injection:** When user holds the ticker: fetch quantity → inject into Analyst input: *"User holds {qty} shares. Weight downside risks accordingly."*

**Confidence-gated re-dispatch:** If Analyst returns `confidence: "low"` and `agents.yaml: confidence.reDispatchOnLow` is true → re-dispatch Researcher with more targeted `focusQuestions` → re-run Analyst once. Both AgentRuns logged.

---

### 10.2 Watchdog

**Model:** `agents.yaml → watchdog`  
**Trigger:** BullMQ repeatable per `scheduler.yaml` · `POST /api/watchdog/trigger` (manual, admin only — separate from Screener trigger)  
**Tools:** `market_data_mcp.get_multiple_quotes` · `market_data_mcp.get_earnings` · `news_mcp.get_ticker_news`

**Scan steps (every run):**
1. `get_multiple_quotes([...allActiveTickers])` — single batch call
2. Compare each against latest `price_snapshot` — flag if `|changePct| > watchdog.yaml: priceAlertThresholdPct`
3. `get_earnings(ticker)` per ticker (sequential; cached for 4h per `mcp.yaml`) — flag if `daysUntil <= earningsPreBriefDaysAhead && daysUntil > 0`
4. For flagged tickers: `get_ticker_news(ticker, since_hours: newsLookbackMinutes/60)`
5. Write `price_snapshot` for every ticker regardless of signals
6. For each signal: create `Alert` record → push to `alert-pipeline` BullMQ queue → Manager processes

---

### 10.3 Screener

**Model:** `agents.yaml → screener`  
**Trigger:** BullMQ cron weekdays 07:00 · `POST /api/screener/trigger` (manual) · `/screener show last` (retrieves last result, no new scan)  
**Tools:** `news_mcp.get_sector_movers` · `news_mcp.get_top_sentiment_shifts` · `macro_signals_mcp.get_eco_calendar`

**Steps:**
1. Scan sectors from `screener.yaml: sectors`
2. Fetch top movers + sentiment shifts per sector
3. Filter by `minimumSignalScore`; take top N per `topResultsPerRun`
4. Persist results to `screener_runs` table with timestamp + `triggeredBy` field
5. Done — the daily brief worker reads `screener_runs` independently at 06:00 and populates the `screenerFinds` section. There is no synchronous handoff to Manager.

---

### 10.4 Researcher

**Model:** `agents.yaml → researcher`  
**Trigger:** Dispatched by Manager with `{ ticker, researchType, focusQuestions, userId }`  
**Tools:** All 6 MCP servers:
- `market_data_mcp.get_fundamentals(ticker)`
- `market_data_mcp.get_ohlcv(ticker, resolution, from, to)`
- `market_data_mcp.get_analyst_ratings(ticker)`
- `market_data_mcp.get_price_targets(ticker)`
- `news_mcp.search_news(query, limit)`
- `news_mcp.get_sentiment_summary(ticker, days)`
- `rag_retrieval_mcp.search(query, filters)` — existing KB context
- `macro_signals_mcp.get_gdelt_risk(topic, days_back)`
- `enterprise_connector_mcp.sharepoint_search_documents(query)`

**Critical constraint:** No LLM synthesis. The LLM step decides which tools to call based on `focusQuestions` and formats raw results into a typed JSON object. It does not draw conclusions or form opinions.

**Output type:**
```typescript
interface ResearchOutput {
  ticker: string;
  focusQuestions: string[];
  ohlcvSummary: { recentTrend: string; keyPricePoints: object };
  fundamentals: object;
  analystRatings: { consensus: string; avgTarget: number; breakdown: object } | null;
  newsItems: Array<{ headline: string; sentiment: string; datetime: number }>;
  sentimentSummary: { avgScore: number; trend: string };
  gdeltRiskScore: number;
  existingKbContext: KbEntry[];
  internalDocs: Array<{ title: string; snippet: string }>;
  confidence: "high" | "medium" | "low";
  confidenceReason: string;
}
```

**Parallel dispatch (comparison mode):**
```typescript
const results = await Promise.all(
  tickers.map(ticker => dispatchResearcher({ ticker, focusQuestions, userId }))
);
// All run simultaneously. Manager passes results[] to single Analyst pass.
```

---

### 10.5 Analyst

**Model:** `agents.yaml → analyst`  
**Trigger:** Dispatched by Manager with pre-collected data package  
**Tools:** None. Receives self-contained input. Makes no external calls whatsoever.

**Modes:**

`standard` — Synthesise ResearchOutput against existing KB thesis. Identify what changed, confirmed, or contradicts. Return structured AnalystOutput.

`devil_advocate` — Uses `analyst.devil-advocate.prompt.ts`. Constructs the strongest possible case *against* the current thesis. Does not hedge or balance. Explicitly and unambiguously contrarian.

`comparison` — Receives `ResearchOutput[]`. Produces structured comparison across all tickers on: valuation, momentum, risk level, analyst consensus, thesis strength.

**Portfolio context:** When `portfolioContext.quantity > 0` is provided, prompt appends: *"User holds {qty} shares. Weight downside risks accordingly."* This is a string injection, not a separate agent.

**Output type:**
```typescript
interface AnalystOutput {
  ticker: string | string[];
  mode: "standard" | "devil_advocate" | "comparison";
  thesisUpdate: string;
  supportingEvidence: string[];
  riskFactors: string[];
  contradictions: string[];
  sentimentDelta: "improved" | "deteriorated" | "unchanged";
  comparisonTable?: object;  // comparison mode only
  confidence: "high" | "medium" | "low";
  confidenceReason: string;
}
```

---

### 10.6 Technician

**Model:** `agents.yaml → technician`  
**Trigger:** Dispatched by Manager for `pattern_request` intent or as part of `alert_investigation`  
**Tools:** `market_data_mcp.get_ohlcv(ticker, "D", from, to)` · `market_data_mcp.get_quote(ticker)`

**Computed indicators** (using `technicalindicators` npm package — no external API):
- SMA(20) / SMA(50) — trend direction, crossover detection
- RSI(14) — overbought (>70) / oversold (<30) / neutral
- MACD(12,26,9) — signal line crossover, histogram direction
- Bollinger Bands(20,2) — band position, squeeze/expansion
- Volume — spike vs 20-day rolling average

**LLM step:** Interprets computed values into natural language. Identifies classical chart patterns (support/resistance, higher-highs/lower-lows, potential formations). No external API access.

**Output type:**
```typescript
interface TechnicianOutput {
  ticker: string;
  periodWeeks: number;
  trend: "bullish" | "bearish" | "neutral" | "mixed";
  keyLevels: { support: number; resistance: number };
  indicators: {
    rsi: { value: number; signal: "overbought" | "oversold" | "neutral" };
    macd: { signal: "bullish_crossover" | "bearish_crossover" | "neutral" };
    bollingerPosition: "upper" | "middle" | "lower" | "outside_upper" | "outside_lower";
    volumeSpike: boolean;
  };
  patterns: string[];
  summary: string;
  confidence: "high" | "medium" | "low";
  confidenceReason: string;
}
```

For `pattern_request`: goes directly to Reporter (no Bookkeeper). For `alert_investigation`: also goes to Bookkeeper as `entryType: "pattern_analysis"`.

---

### 10.7 Bookkeeper

**Model:** `agents.yaml → bookkeeper`  
**Trigger:** After Analyst output in all mission types (operator_query, alert_investigation, comparison, devil_advocate, earnings_prebrief, trade_request, daily_brief). After Technician output when Technician is part of a full investigation (not for standalone pattern_request). Bookkeeper always runs before Trader in trade_request flow.  
**Tools:** `rag_retrieval_mcp.get_current_thesis(ticker)` + internal DB operations via typed repository interface.

**Write protocol — executed in strict sequence:**

```mermaid
flowchart TD
    A["Receive AnalystOutput\n(includes mode field)"] --> B["Fetch existing thesis\nrag_retrieval_mcp.get_current_thesis(ticker)"]
    B --> C{Thesis exists?}
    C -->|no| G["changeType: initial\n(nothing to snapshot)"]
    C -->|yes| MA{mode == devil_advocate?}
    MA -->|yes| JDA["Snapshot EXISTING thesis\nchangeType: devil_advocate\n(skip contradiction detection —\ncontradiction is implicit)"]
    MA -->|no| D["Run contradiction detection\nbookkeeper.contradiction.prompt.ts\nStructured JSON LLM call"]
    D --> E{contradictionFound\n&& severity == high?}
    E -->|yes| F["Create Alert\ntype: thesis_contradiction\nseverity: high"]
    F --> H["Snapshot EXISTING thesis\nchangeType: contradiction"]
    E -->|no| I["Snapshot EXISTING thesis\nchangeType: update"]
    JDA --> L
    G --> L
    H --> L["Generate embedding\nOpenAI text-embedding-3-small"]
    I --> L
    L --> M["Upsert kb_entry\n+ contradiction_flag + vector"]
    M --> N["Update Mission.status = complete"]
```

**Contradiction detection prompt** (`bookkeeper.contradiction.prompt.ts`):
```
EXISTING THESIS: {existingThesis}
NEW ANALYST OUTPUT: {newThesisUpdate}

Does the new output materially contradict the existing thesis?
A contradiction: direct factual conflict, significant sentiment reversal,
or a new risk that fundamentally undermines the thesis.
Minor updates or added nuance are NOT contradictions.

Respond with JSON only — no explanation outside the JSON:
{ "contradictionFound": boolean, "contradictionNote": string, "severity": "high" | "medium" }
```

---

### 10.8 Reporter

**Model:** `agents.yaml → reporter` (local LM Studio; fallback: gpt-4o-mini)  
**Trigger:** Last step of every mission · BullMQ `daily-brief` job  
**Tools:** `telegram.post(userId, message)` · `db.writeDailyBrief(userId, brief)`

Note: `ScreenerRun` records are written by the Screener worker directly, not by Reporter. Reporter only formats output and delivers it.

**Output label system:**
- `⚠️ DEVIL'S ADVOCATE` — contrarian analysis
- `⚡ THESIS CONTRADICTION` — Bookkeeper flagged a conflict
- `📅 EARNINGS IN N DAYS` — earnings pre-brief
- `📊 TECHNICAL ANALYSIS` — Technician output
- `🎫 TRADE TICKET PENDING` — approval required

**DailyBrief interface:**
```typescript
interface DailyBrief {
  date: string;
  topSignals: { ticker: string; signal: string; severity: string }[];
  thesisUpdates: { ticker: string; change: string; contradiction?: string }[];
  upcomingEvents: { date: string; ticker?: string; event: string; daysUntil: number }[];
  screenerFinds: { ticker: string; reason: string; signalScore: number }[];
  watchlistSummary: { ticker: string; price: number; changePct: number; trend: string }[];
  analystConsensus: { ticker: string; rating: string; priceTargetUpsidePct: number }[];  // from Researcher's get_analyst_ratings call
  pendingTickets: number;
  generatedAt: string;
}
```

---

### 10.9 Trader

**Model:** `agents.yaml → trader`  
**Trigger:** Explicit dispatch only — Manager dispatches when user sends `/trade` or chat requests a trade  
**Tools:** `trader_platform_mcp.create_ticket(...)` · `rag_retrieval_mcp.get_current_thesis(ticker)`

**Target broker: Saxo Bank.** The trader-platform-mcp is designed to mirror the Saxo Bank OpenAPI interface. In the PoC (`trader.yaml: platform: mock`), all handlers return realistic simulated responses. In production (`platform: saxo`), the `approve_ticket` handler executes a real order via the Saxo Bank REST API using OAuth 2.0 credentials. The Trader agent code is identical in both modes — only the MCP server handler changes.

**Dispatch conditions (Manager enforces ALL):**
1. User explicitly sent `/trade TICKER buy|sell QTY` via Telegram (PoC scope: explicit command only — auto-dispatch based on Analyst confidence is deferred post-PoC)
2. User role is `admin` or `analyst` (not `viewer`)
3. `app.yaml: featureFlags.traderAgent` is `true`
4. User's pending ticket count < `trader.yaml: maxPendingTicketsPerUser`

**Trade ticket lifecycle:**

```mermaid
stateDiagram-v2
    [*] --> pending_approval: Trader creates ticket
    pending_approval --> approved: /approve TICKET_ID
    pending_approval --> rejected: /reject TICKET_ID
    pending_approval --> expired: expiry_hours elapsed (BullMQ job)
    pending_approval --> cancelled: operator cancels
    approved --> [*]: mock execution price set
    rejected --> [*]
    expired --> [*]
    cancelled --> [*]
```

**Always appends:** `"⚠️ This ticket requires explicit human approval. FinSight never executes trades autonomously."`

---

## 11. MCP Server Specifications

Every MCP server is a standalone Hono service exposing:
- `GET /health` → `{ status: "ok", uptime: number }`
- `GET /mcp/tools` → full tool manifest (name, description, JSON Schema for input/output) — **shown in demo Scene 4**
- `POST /mcp/invoke` → `{ tool: string, input: object }` → `{ output: object, durationMs: number }`

### MCP Tool Registration Pattern

```mermaid
sequenceDiagram
    participant API as hono-api startup
    participant MC as mcp-client.ts
    participant MCP as MCP Server
    participant AGT as Agent

    API->>MC: initMcpClients(config)
    MC->>MCP: GET /mcp/tools
    MCP-->>MC: tool manifest JSON
    MC->>MC: register each tool as Vercel AI SDK tool()
    MC-->>API: toolSets ready

    Note over AGT: During a mission...
    AGT->>MC: call tool("get_ohlcv", { ticker: "NVDA" })
    MC->>MCP: POST /mcp/invoke { tool, input }
    MCP-->>MC: { output, durationMs }
    MC-->>AGT: typed output
```

**Adding a new data source:** Create a new Hono service with `/health`, `/mcp/tools`, `/mcp/invoke`. Add its URL to `mcp.yaml`. Add it to `apps/api/src/lib/mcp-client.ts` registration. No agent code changes.

---

### 11.1 market-data-mcp — Port 3001

**Sources:** Finnhub + Financial Modeling Prep | **Cache TTLs:** from `mcp.yaml`

```
get_quote(ticker)                → { price, change_pct, volume, market_cap, high_52w, low_52w }
get_ohlcv(ticker, res, from, to) → { candles: [{ o,h,l,c,v,t }] }
get_fundamentals(ticker)         → { pe_ratio, eps, revenue_growth_yoy, debt_to_equity, sector }
get_earnings(ticker)             → { next_date, days_until, estimate_eps, prev_eps, surprise_pct_last }
get_multiple_quotes(tickers[])   → { quotes: Record<ticker, { price, change_pct, volume }> }
get_analyst_ratings(ticker)      → { strong_buy, buy, hold, sell, strong_sell, period }
get_price_targets(ticker)        → { avg_target, high_target, low_target, analyst_count }
```

### 11.2 macro-signals-mcp — Port 3002

**Sources:** GDELT (free, no key) + Alpha Vantage | **Cache TTLs:** from `mcp.yaml`

```
get_gdelt_risk(topic, days_back)    → { event_count, avg_tone, top_themes[], risk_score, risk_label }
get_eco_calendar(days_ahead)        → { events: [{ date, name, importance, forecast, previous }] }
get_indicator(indicator)            → { series: [{ date, value }], latest, trend }
get_sector_macro_context(sector)    → { summary, relevant_events[], risk_score }
```

### 11.3 news-mcp — Port 3003

**Sources:** Finnhub + Alpha Vantage | **Cache TTLs:** from `mcp.yaml`

```
get_ticker_news(ticker, limit, since_hours?) → { articles: [{ headline, summary, sentiment, score }] }
search_news(query, limit)                    → { articles: [...] }
get_sentiment_summary(ticker, days)          → { avg_score, positive_pct, negative_pct, trend }
get_top_sentiment_shifts(sectors[], top_n)   → { movers: [{ ticker, sector, delta, top_headline }] }
get_sector_movers(sector, limit)             → { movers: [{ ticker, change_pct, top_headline }] }
```

### 11.4 rag-retrieval-mcp — Port 3004

**Source:** PostgreSQL + pgvector (Bookkeeper is the sole writer)  
**Search:** Hybrid cosine similarity + BM25 full-text, merged with RRF. Weights from `rag.yaml: bm25Weight`.

```
search(query, limit, filters?)         → { entries: [{ id, content, ticker, entry_type, similarity_score, contradiction_flag }] }
get_current_thesis(ticker)             → { thesis, last_updated, evidence[], risk_factors[], confidence, contradiction_flags[] } | null
get_thesis_history(ticker, limit?)     → { snapshots: [{ id, thesis, confidence, change_type, change_summary, created_at }] }
get_summary(date?)                     → { summary, top_signals[], notable_changes[] }
get_stats()                            → { total_entries, by_type, tickers_tracked, contradiction_count, last_updated }
```

### 11.5 enterprise-connector-mcp — Port 3005

**PoC:** Realistic mock data files. **Production:** Swap handler bodies for real Microsoft Graph SDK calls. Agent code is identical in both cases.

```
sharepoint_search_documents(query, site?) → { docs: [{ title, url, last_modified, author, snippet }] }
graph_get_recent_emails(topic, limit)     → { emails: [{ from, subject, snippet, received_at }] }
```

### 11.6 trader-platform-mcp — Port 3006

**Target broker: Saxo Bank OpenAPI.** The MCP tool interface mirrors the Saxo Bank REST API structure. In PoC mode (`trader.yaml: platform: mock`) all handlers return realistic simulated data. In production (`platform: saxo`) the `place_order` handler calls the real Saxo Bank API using OAuth 2.0 tokens. The Trader agent code is identical in both modes.

**Saxo Bank API context:**
- Base URL (sandbox): `https://gateway.saxobank.com/sim/openapi`
- Base URL (live): `https://gateway.saxobank.com/openapi`
- Auth: OAuth 2.0 PKCE flow. Credentials in `.env`: `SAXO_CLIENT_ID`, `SAXO_CLIENT_SECRET`, `SAXO_REDIRECT_URI`
- Key endpoints used: `POST /trade/v2/orders` (place order), `GET /port/v1/accounts` (get account key), `GET /trade/v1/orders` (list orders)

**Tool interface:**
```
# Ticket lifecycle (FinSight internal state)
create_ticket(userId, ticker, action, quantity, rationale, confidence, expiry_hours)
  → { ticket_id, status: "pending_approval", created_at, expires_at }

get_ticket(ticket_id)
  → { ticket_id, user_id, ticker, action, quantity, rationale, status,
      expires_at, execution_price?, executed_at? }

list_pending_tickets(user_id?)
  → { tickets: [...] }

# Order execution (mock vs Saxo Bank)
place_order(ticket_id, approved_by)
  → { ticket_id, status: "approved", execution_price, executed_at, order_id? }
  # mock mode:  simulates fill at market_price ± trader.yaml:mockExecutionSlippagePct
  # saxo mode:  POST /trade/v2/orders to Saxo Bank sandbox/live, returns real OrderId

reject_ticket(ticket_id, rejected_by, reason?)
  → { ticket_id, status: "rejected" }

cancel_ticket(ticket_id)
  → { ticket_id, status: "cancelled" }

# Account info (saxo mode only; mock returns stub)
get_account_info()
  → { account_key, client_name, currency, net_liquidity }
```

**Mode switching:** Change `trader.yaml: platform` from `mock` to `saxo`. No code changes. Saxo credentials must be set in `.env`. The `approve_ticket` handler in `trader-platform/src/tools/place-order.ts` contains the only branching logic between mock and real execution.

---

## 12. Database Schema (Prisma)

### Key Data Relationships

```mermaid
erDiagram
    User ||--o{ PortfolioItem : has
    User ||--o{ WatchlistItem : has
    User ||--o{ Mission : triggers
    User ||--o{ Alert : receives
    User ||--o{ DailyBrief : receives
    User ||--o{ TradeTicket : owns
    User ||--o{ RefreshToken : has

    Mission ||--o{ AgentRun : contains
    Mission ||--o{ KbEntry : produces
    Mission ||--o{ KbThesisSnapshot : produces
    Mission ||--o{ Alert : generates
    Mission ||--o{ TradeTicket : produces

    WatchlistItem ||--o{ PriceSnapshot : accumulates

    KbEntry {
        string ticker
        string entryType
        string content
        vector embedding
        bool contradictionFlag
        string contradictionNote
    }

    KbThesisSnapshot {
        string ticker
        string thesis
        string changeType
        string changeSummary
        string confidence
    }

    AgentRun {
        string agentName
        string model
        string provider
        int tokensIn
        int tokensOut
        float costUsd
        json toolCalls
    }

    TradeTicket {
        string action
        float quantity
        string status
        string confidence
        datetime expiresAt
        float mockExecutionPrice
    }

    ScreenerRun {
        json results
        string triggeredBy
        datetime createdAt
    }
```

### Full Prisma Schema

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [pgvector(map: "vector")]
}

model User {
  id             String         @id @default(cuid())
  email          String         @unique
  passwordHash   String
  name           String
  role           String         @default("analyst")  // admin | analyst | viewer
  telegramHandle String?        @unique
  telegramChatId BigInt?        // populated on first Telegram message from this user
  active         Boolean        @default(true)
  createdAt      DateTime       @default(now())
  createdBy      String?
  refreshTokens  RefreshToken[]
  portfolioItems PortfolioItem[]
  watchlistItems WatchlistItem[]
  missions       Mission[]
  alerts         Alert[]
  dailyBriefs    DailyBrief[]
  tradeTickets   TradeTicket[]
}

model RefreshToken {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([userId])
}

model PortfolioItem {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  ticker    String
  quantity  Float
  updatedAt DateTime @updatedAt

  @@unique([userId, ticker])
  @@index([userId])
}

model WatchlistItem {
  id             String          @id @default(cuid())
  userId         String
  user           User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  ticker         String
  name           String
  sector         String
  listType       String          @default("interesting") // "portfolio" | "interesting"
  addedAt        DateTime        @default(now())
  active         Boolean         @default(true)
  priceSnapshots PriceSnapshot[]

  @@unique([userId, ticker, listType])
  @@index([userId, active])
}

model PriceSnapshot {
  id              String        @id @default(cuid())
  ticker          String
  watchlistItemId String
  watchlistItem   WatchlistItem @relation(fields: [watchlistItemId], references: [id])
  price           Float
  changePct       Float
  volume          BigInt
  capturedAt      DateTime      @default(now())

  @@index([ticker, capturedAt])
}

model Mission {
  id           String        @id @default(cuid())
  userId       String?
  user         User?         @relation(fields: [userId], references: [id])
  type         String        // operator_query | alert_investigation | comparison |
                             // devil_advocate | pattern_request | earnings_prebrief |
                             // trade_request | daily_brief
  status       String        // pending | running | complete | failed
  trigger      String        // telegram | watchdog | scheduled | kb_fast_path | manual
  inputData    Json
  outputData   Json?
  tickers      String[]
  agentRuns    AgentRun[]
  alerts       Alert[]
  kbEntries    KbEntry[]
  kbThesisSnapshots KbThesisSnapshot[]
  dailyBriefs  DailyBrief[]
  tradeTickets TradeTicket[]
  createdAt    DateTime      @default(now())
  completedAt  DateTime?
}

model AgentRun {
  id               String   @id @default(cuid())
  missionId        String
  mission          Mission  @relation(fields: [missionId], references: [id])
  agentName        String   // manager|watchdog|screener|researcher|analyst|technician|bookkeeper|reporter|trader
  model            String   // e.g. "claude-sonnet-4-20250514"
  provider         String   // anthropic | openai | azure | lmstudio
  inputData        Json
  outputData       Json?
  toolCalls        Json[]   // [{ tool, mcpServer, input, output, durationMs, state }]
  confidence       String?  // high | medium | low
  confidenceReason String?
  durationMs       Int?
  tokensIn         Int?
  tokensOut        Int?
  costUsd          Float?   // computed from pricing.yaml at write time
  status           String   // running | complete | failed
  errorMessage     String?
  createdAt        DateTime @default(now())

  @@index([missionId])
  @@index([agentName, createdAt])
  @@index([provider, createdAt])  // for spend aggregation
}

model KbEntry {
  id                String                       @id @default(cuid())
  ticker            String?
  entryType         String                       // research_note | thesis | signal |
                                                 // earnings_note | pattern_analysis | brief_summary
  content           String
  embedding         Unsupported("vector(1536)")?
  metadata          Json                         @default("{}")
  contradictionFlag Boolean                      @default(false)
  contradictionNote String?
  missionId         String?
  mission           Mission?                     @relation(fields: [missionId], references: [id])
  createdAt         DateTime                     @default(now())
  updatedAt         DateTime                     @updatedAt

  @@index([ticker])
  @@index([entryType])
  @@index([createdAt])
}

model KbThesisSnapshot {
  id            String   @id @default(cuid())
  ticker        String
  thesis        String
  confidence    String
  changeType    String   // initial | update | contradiction | devil_advocate
  changeSummary String?
  missionId     String?
  mission       Mission? @relation(fields: [missionId], references: [id])
  createdAt     DateTime @default(now())

  @@index([ticker, createdAt])
  @@index([missionId])
}

model ScreenerRun {
  id          String   @id @default(cuid())
  results     Json     // Array<{ ticker, sector, reason, signalScore, topHeadline }>
  triggeredBy String   // scheduled | manual | telegram
  createdAt   DateTime @default(now())
}

model Alert {
  id           String   @id @default(cuid())
  userId       String?
  user         User?    @relation(fields: [userId], references: [id])
  ticker       String?
  alertType    String   // price_spike | volume_spike | news_event | macro_risk |
                        // thesis_contradiction | earnings_approaching | pattern_signal
  severity     String   // high | medium | low
  message      String
  acknowledged Boolean  @default(false)
  missionId    String?
  mission      Mission? @relation(fields: [missionId], references: [id])
  createdAt    DateTime @default(now())

  @@index([userId, acknowledged, createdAt])
}

model DailyBrief {
  id               String   @id @default(cuid())
  userId           String
  user             User     @relation(fields: [userId], references: [id])
  date             String   // "2026-03-28"
  topSignals       Json
  thesisUpdates    Json
  upcomingEvents   Json
  screenerFinds    Json
  watchlistSummary Json
  analystConsensus Json
  pendingTickets   Int      @default(0)
  rawText          String
  missionId        String?
  mission          Mission? @relation(fields: [missionId], references: [id])
  generatedAt      DateTime @default(now())

  @@unique([userId, date])
  @@index([userId])
}

model TradeTicket {
  id                 String    @id @default(cuid())
  userId             String
  user               User      @relation(fields: [userId], references: [id])
  ticker             String
  action             String    // buy | sell
  quantity           Float
  rationale          String
  confidence         String    // high | medium
  basedOnMissions    String[]
  status             String    // pending_approval | approved | rejected | expired | cancelled
  expiresAt          DateTime
  approvedBy         String?
  approvedAt         DateTime?
  rejectedBy         String?
  rejectionReason    String?
  mockExecutionPrice Float?
  mockExecutedAt     DateTime?
  missionId          String?
  mission            Mission?  @relation(fields: [missionId], references: [id])
  createdAt          DateTime  @default(now())

  @@index([userId, status])
  @@index([status, expiresAt])
}
```

---

## 13. Repository Structure

```
finsight-ai-hub/
│
├── config/
│   ├── runtime/                          # YAML behavioral config — committed, mounted :ro
│   │   ├── agents.yaml
│   │   ├── pricing.yaml                  # Token cost rates per provider/model
│   │   ├── mcp.yaml
│   │   ├── scheduler.yaml
│   │   ├── watchdog.yaml
│   │   ├── screener.yaml
│   │   ├── rag.yaml
│   │   ├── trader.yaml
│   │   ├── auth.yaml
│   │   ├── telegram.yaml
│   │   └── app.yaml
│   └── types/                            # Zod schemas — no values, compiled into bundle
│       ├── agents.schema.ts
│       ├── pricing.schema.ts
│       ├── mcp.schema.ts
│       ├── scheduler.schema.ts
│       ├── watchdog.schema.ts
│       ├── screener.schema.ts
│       ├── rag.schema.ts
│       ├── trader.schema.ts
│       ├── auth.schema.ts
│       ├── telegram.schema.ts
│       └── app.schema.ts
│
├── packages/
│   └── shared-types/                     # Shared domain types — zero framework deps
│       ├── src/
│       │   ├── agents.types.ts           # AgentName enum, ResearchOutput, AnalystOutput, etc.
│       │   ├── missions.types.ts         # MissionType enum, IntentType enum
│       │   ├── mcp.types.ts              # Per-tool input/output types
│       │   ├── api.types.ts              # Request/response types for all routes
│       │   └── index.ts
│       └── package.json
│
├── apps/
│   │
│   ├── api/                              # Main Hono API + agent orchestration
│   │   ├── src/
│   │   │   ├── index.ts                  # App entry, middleware chain, startup probes
│   │   │   ├── routes/
│   │   │   │   ├── auth.ts               # /auth/login · /refresh · /logout · /me
│   │   │   │   ├── admin.ts              # /admin/users · /admin/config · /api/admin/status
│   │   │   │   ├── chat.ts               # POST /api/chat · /api/chat/devil
│   │   │   │   ├── screener.ts           # POST /api/screener/trigger · GET /api/screener/last
│   │   │   │   ├── missions.ts
│   │   │   │   ├── kb.ts
│   │   │   │   ├── portfolio.ts
│   │   │   │   ├── watchlist.ts
│   │   │   │   ├── alerts.ts
│   │   │   │   ├── tickets.ts
│   │   │   │   ├── agents.ts             # GET /api/agents/status (LM Studio probe result)
│   │   │   │   └── briefs.ts
│   │   │   ├── agents/
│   │   │   │   ├── manager.ts
│   │   │   │   ├── watchdog.ts
│   │   │   │   ├── screener.ts
│   │   │   │   ├── researcher.ts
│   │   │   │   ├── analyst.ts
│   │   │   │   ├── technician.ts
│   │   │   │   ├── bookkeeper.ts
│   │   │   │   ├── reporter.ts
│   │   │   │   ├── trader.ts
│   │   │   │   └── prompts/
│   │   │   │       ├── manager.prompt.ts
│   │   │   │       ├── researcher.prompt.ts
│   │   │   │       ├── analyst.prompt.ts
│   │   │   │       ├── analyst.devil-advocate.prompt.ts
│   │   │   │       ├── technician.prompt.ts
│   │   │   │       ├── bookkeeper.prompt.ts
│   │   │   │       ├── bookkeeper.contradiction.prompt.ts
│   │   │   │       ├── reporter.prompt.ts
│   │   │   │       ├── trader.prompt.ts
│   │   │   │       ├── screener.prompt.ts
│   │   │   │       ├── watchdog.prompt.ts
│   │   │   │       └── shared/
│   │   │   │           ├── confidence-instruction.prompt.ts
│   │   │   │           └── portfolio-context.prompt.ts
│   │   │   ├── workers/
│   │   │   │   ├── scheduler.ts              # Registers BullMQ repeatable jobs from scheduler.yaml
│   │   │   │   ├── watchdog-worker.ts
│   │   │   │   ├── screener-worker.ts
│   │   │   │   ├── brief-worker.ts
│   │   │   │   ├── earnings-worker.ts
│   │   │   │   ├── ticket-expiry-worker.ts
│   │   │   │   └── alert-pipeline-worker.ts
│   │   │   ├── telegram/
│   │   │   │   ├── bot.ts                    # Telegraf init + command handler registration
│   │   │   │   ├── handler.ts                # Command → internal API call mapping
│   │   │   │   └── formatter.ts              # Message length + label rules
│   │   │   └── lib/
│   │   │       ├── config-loader.ts          # YAML load + Zod validate + chokidar hot-reload
│   │   │       ├── model-router.ts           # LM Studio probe + provider map + Azure
│   │   │       ├── pricing.ts                # Cost calculation from pricing.yaml
│   │   │       ├── mcp-client.ts             # MCP tool registration as Vercel AI SDK tool()
│   │   │       ├── db.ts                     # Prisma client singleton
│   │   │       ├── redis.ts                  # Redis + BullMQ queue definitions
│   │   │       ├── langsmith.ts              # LangSmith trace middleware
│   │   │       ├── jwt.ts
│   │   │       ├── password.ts
│   │   │       ├── portfolio-context.ts      # DB lookup helper for portfolio enrichment
│   │   │       └── middleware/
│   │   │           ├── request-id.ts
│   │   │           ├── logger.ts             # Pino structured JSON, includes requestId
│   │   │           ├── auth.ts
│   │   │           ├── role-guard.ts
│   │   │           └── rate-limit.ts
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── seed.ts
│   │   │   └── migrations/
│   │   └── package.json
│   │
│   └── frontend/                         # Admin-only Mission Control dashboard
│       ├── src/
│       │   ├── App.tsx
│       │   ├── contexts/
│       │   │   └── AuthContext.tsx        # JWT in memory, auto-refresh
│       │   ├── hooks/
│       │   │   └── useAdminStatus.ts     # Polls GET /api/admin/status every 3s
│       │   └── components/
│       │       ├── LoginPage.tsx
│       │       ├── Layout.tsx             # 4-column layout + header
│       │       ├── AgentColumn.tsx        # Renders 9 AgentCard components
│       │       ├── AgentCard.tsx          # Compact single-row card per agent
│       │       ├── MissionPanel.tsx       # Active mission pipeline + MissionLog
│       │       ├── PipelineView.tsx       # Vertical step list with tool call sub-items
│       │       ├── ToolCallList.tsx       # Tool call states (done/spinning/pending)
│       │       ├── MissionLog.tsx         # Last 10 missions with LangSmith links
│       │       ├── SystemPanel.tsx        # Health grid + KB stats + queue/alert counts
│       │       └── SpendPanel.tsx         # Per-provider spend + admin action buttons
│       ├── index.html
│       └── package.json
│
├── mcp-servers/
│   ├── market-data/
│   │   ├── src/
│   │   │   ├── index.ts                  # Hono: /health · /mcp/tools · /mcp/invoke
│   │   │   ├── tools/
│   │   │   │   ├── registry.ts           # Tool manifest array — imported by /mcp/tools
│   │   │   │   ├── get-quote.ts
│   │   │   │   ├── get-ohlcv.ts
│   │   │   │   ├── get-fundamentals.ts
│   │   │   │   ├── get-earnings.ts
│   │   │   │   ├── get-multiple-quotes.ts
│   │   │   │   ├── get-analyst-ratings.ts
│   │   │   │   └── get-price-targets.ts
│   │   │   ├── cache.ts                  # Redis TTL helpers, TTLs from mcp.yaml
│   │   │   └── clients/
│   │   │       ├── finnhub.ts
│   │   │       └── fmp.ts
│   │   └── package.json
│   ├── macro-signals/src/ ...
│   ├── news/src/ ...
│   ├── rag-retrieval/src/ ...
│   ├── enterprise-connector/
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── tools/
│   │   │   │   ├── registry.ts
│   │   │   │   ├── sharepoint-search.ts  # Swap body for Graph SDK in production
│   │   │   │   └── graph-emails.ts       # Swap body for Graph SDK in production
│   │   │   └── mock-data/
│   │   │       ├── documents.ts          # Realistic quarterly reports + research docs
│   │   │       └── emails.ts             # Realistic corporate email threads
│   │   └── package.json
│   └── trader-platform/
│       ├── src/
│       │   ├── index.ts
│       │   ├── tools/
│       │   │   ├── registry.ts
│       │   │   ├── create-ticket.ts
│       │   │   ├── get-ticket.ts
│       │   │   ├── list-pending-tickets.ts
│       │   │   ├── approve-ticket.ts     # Swap body for broker SDK in production
│       │   │   ├── reject-ticket.ts
│       │   │   └── cancel-ticket.ts
│       │   └── db.ts
│       └── package.json
│
├── infra/
│   └── pulumi/
│       └── index.ts                      # AWS ECS Fargate tasks (one per service),
│                                         # RDS Postgres 16, ElastiCache Redis 7,
│                                         # ECR repos, ALB
│
├── docker-compose.yml
├── docker-compose.dev.yml
├── .env.example
├── .env                                  # Gitignored — local secrets only
├── tests/
│   └── e2e/
│       ├── auth.e2e.ts
│       ├── missions.e2e.ts
│       └── telegram-commands.e2e.ts
├── .github/
│   └── workflows/
│       └── ci.yml
├── scripts/
│   ├── deploy.sh
│   └── logs.sh
├── pnpm-workspace.yaml
└── package.json
```

---

## 14. Seed Script (prisma/seed.ts)

Run `pnpm seed` after `docker compose up`. Creates a fully demo-ready state from cold start.

1. **Admin user** — `admin@finsight.local`, password from `ADMIN_PASSWORD`, role: admin, telegramHandle from `TELEGRAM_ADMIN_HANDLE`
2. **Analyst user** — `analyst@finsight.local`, password: `demo1234`, role: analyst
3. **Admin portfolio** — NVDA 50 shares, AAPL 100 shares, GLD 20 shares
4. **Admin watchlists** — "portfolio": NVDA, AAPL, GLD; "interesting": SPY, AMD, MSFT
5. **NVDA thesis** — current bullish entry + 4 `KbThesisSnapshot` records dated -10d/-7d/-4d/-1d (cautious → neutral → contradiction → bullish). Snapshot at -4d has `changeType: "contradiction"` — creates a realistic 4-entry history for `/history NVDA` at demo start.
6. **Screener run** — one `ScreenerRun` record (dated this morning) with 3 sector finds including AMD in semiconductors. Makes `/screener show last` immediately useful.
7. **Earnings alert** — NVDA `next_earnings_date` set 2 days ahead in mock data. Creates a pre-seeded `earnings_approaching` Alert so SystemHealth shows 1 pending alert at demo start.
8. **2 prior missions** — with full AgentRun records so MissionLog is populated at demo start.
9. **3 ingested documents** — hardcoded realistic earnings transcript text (not actual PDF files), chunked, embedded, and stored in pgvector via the Bookkeeper embedding pipeline.

---

## 15. Environment Variables (.env)

```bash
# LLM — secrets only; model names and routing are in config/runtime/agents.yaml
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_ENDPOINT=https://YOUR_RESOURCE.openai.azure.com
AZURE_OPENAI_DEPLOYMENT=gpt4o-prod
LM_STUDIO_BASE_URL=http://192.168.1.X:1234   # Windows laptop LAN IP

# Finance APIs (all free tiers sufficient for demo)
FINNHUB_API_KEY=           # 60 req/min free
FMP_API_KEY=               # 250 req/day free
ALPHA_VANTAGE_API_KEY=     # 25 req/day free
# GDELT: no key required

# Saxo Bank (only needed when trader.yaml: platform == "saxo")
# Register at developer.saxo.com — use SIM app for sandbox
SAXO_CLIENT_ID=
SAXO_CLIENT_SECRET=
SAXO_REDIRECT_URI=http://localhost:3000/auth/saxo/callback

# Observability
LANGSMITH_API_KEY=
LANGSMITH_PROJECT=finsight-ai-hub

# Telegram
TELEGRAM_BOT_TOKEN=
TELEGRAM_ADMIN_HANDLE=@yourtelegramhandle   # Used by seed script to create the admin User record with this handle

# Infrastructure
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/finsight
REDIS_URL=redis://redis:6379

# Auth
JWT_SECRET=                # 64+ random characters

# Seed
ADMIN_EMAIL=admin@finsight.local
ADMIN_PASSWORD=
```

All behavioral config (model names, thresholds, schedules, feature flags, TTLs, pricing) lives in `config/runtime/*.yaml` — never in `.env`.

---

## 16. Build Phases — 1 Week

### Day 1 — Foundation + Config + Auth + First MCP Servers

- pnpm workspace init, `packages/shared-types` with all shared types and `const` enums
- **Write all `config/runtime/*.yaml` first** — Config-as-Code from minute one
- Write all `config/types/*.schema.ts` Zod schemas
- `lib/config-loader.ts` — YAML load + Zod validate + chokidar hot-reload + fail-fast exit
- `lib/pricing.ts` — cost calculation from `pricing.yaml`
- Docker Compose with all 12 services (stubs), config volume mounts, pgvector extension
- Full Prisma schema + first migration + `db.ts`
- Auth routes: `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me`
- Admin routes: users CRUD + `/admin/config` + `/admin/config/reload` + `GET /api/admin/status`
- Middleware: requestId, Pino logger, auth (JWT), roleGuard, rateLimiter
- All 6 MCP Hono skeletons: `/health` + `/mcp/tools` manifest + `/mcp/invoke` router
- `market-data-mcp` fully implemented — all 7 tools, Finnhub + FMP clients, Redis cache
- `news-mcp` fully implemented — all 5 tools
- Self-hosted GitHub Actions runner installed on Linux server; `scripts/deploy.sh`
- Unit tests: config-loader (valid/invalid YAML), auth middleware, market-data + news tool handlers

**Milestone:** Login returns JWT. All 6 MCP `/health` green. Real quotes from `get_quote("NVDA")`. CI runs on push.

---

### Day 2 — Remaining MCP Servers + Model Router + Pricing

- `macro-signals-mcp` — all 4 tools, GDELT + Alpha Vantage
- `rag-retrieval-mcp` — all 5 tools, hybrid pgvector+BM25 search (empty KB, functional)
- `enterprise-connector-mcp` — 2 tools, realistic mock data files
- `trader-platform-mcp` — all 6 tools, full ticket lifecycle with DB
- `lib/model-router.ts` — LM Studio startup probe + re-probe cron + Azure + OpenAI + Anthropic provider map + routing table from `agents.yaml`
- `lib/mcp-client.ts` — MCP tool registration as Vercel AI SDK `tool()` bindings
- Unit tests: model-router (LM Studio available/unavailable/fallback), remaining MCP tool handlers, trader ticket state machine

**Milestone:** All 6 MCP manifests browseable at `/mcp/tools`. Model router startup log shows all 4 providers. Ticket create/approve/reject via MCP invoke.

---

### Day 3 — Collector Agents + Queue Infrastructure

- Vercel AI SDK wired, `lib/redis.ts` + BullMQ queue definitions
- `workers/scheduler.ts` — registers repeatable jobs from `scheduler.yaml`
- `watchdog.ts` — batch quote fetch, snapshot writes, earnings check, alert creation + BullMQ push
- `screener.ts` — sector scan, signal scoring, `ScreenerRun` DB write
- `researcher.ts` — all MCP tool bindings, typed ResearchOutput, no synthesis
- `technician.ts` — OHLCV fetch, `technicalindicators` calculations, LLM pattern interpretation
- Workers: `watchdog-worker.ts`, `screener-worker.ts`, `ticket-expiry-worker.ts`
- REST routes: `/api/screener/trigger`, `/api/screener/last`, `/api/agents/status`
- Unit tests: Watchdog threshold logic, Screener signal scoring, Researcher output schema, Technician indicator math

**Milestone:** Watchdog BullMQ job runs on schedule, writes `PriceSnapshot` records. Researcher returns typed ResearchOutput. Technician returns typed TechnicianOutput.

---

### Day 4 — Reasoning + Memory + Trader + Manager

- `analyst.ts` — standard/devil_advocate/comparison modes, portfolio context, confidence scoring
- `bookkeeper.ts` — contradiction detection (structured LLM), thesis snapshot, pgvector upsert, cost recording
- `trader.ts` — dispatch conditions, ticket creation, rationale formatting
- `reporter.ts` — LM Studio routing + fallback, label system, DailyBrief writer, Telegram push
- `manager.ts` — full intent classification, all routing paths, KB fast-path, portfolio enrichment, confidence re-dispatch, parallel Researcher dispatch
- `lib/portfolio-context.ts` — DB lookup helper
- All prompts colocated alongside their agent: `agents/*.prompt.ts`, shared prompts in `agents/shared/`
- Workers: `brief-worker.ts`, `earnings-worker.ts`, `alert-pipeline-worker.ts`
- Unit tests: Analyst output schema (all modes), Bookkeeper contradiction detection, Trader dispatch conditions, Manager intent classification
- Integration tests: full Bookkeeper DB write, trade ticket lifecycle

**Milestone:** Full pipeline end-to-end — send `/compare NVDA AMD` via Telegram bot → Manager dispatches two parallel Researchers → Analyst (comparison mode) → Bookkeeper (two KB entries created, `costUsd` recorded on each AgentRun) → Reporter (Telegram comparison reply arrives). Full Mission record + all AgentRuns visible in DB.

---

### Day 5 — All API Routes + Telegram Bot + Streaming

- All remaining API routes: missions, kb, portfolio, watchlist, alerts, tickets, briefs
- Telegram bot (`telegram/bot.ts`) — Telegraf + all command handlers
- `telegram/handler.ts` — command → internal API call
- `telegram/formatter.ts` — label application, message length
- Parallel comparison flow: `/compare NVDA AMD` → 2 parallel Researcher dispatches → single Analyst
- `/screener show last` and `/pattern NVDA 3w` tested end-to-end
- Unit tests: Telegram command parser, all route input validation (Zod → 400 on invalid payloads)
- Integration tests: auth flow, mission creation + retrieval

**Milestone:** `/pattern NVDA 3w` from Telegram → Technician runs → Reporter replies in < 15s. All routes functional.

---

### Day 6 — Admin Dashboard (Frontend)

- React + Vite, admin-only, nginx :4000
- `useAdminStatus` hook — polls `GET /api/admin/status` every 3s
- `AgentColumn` + `AgentCard` — 9 compact cards, green/amber/grey left border accent
- `MissionPanel` — `PipelineView` with `ToolCallList` sub-items (spinning indicator for active tool calls) + `MissionLog` (last 10 missions, LangSmith links)
- `SystemPanel` — health badges grid, KB stats, alert/ticket counts
- `SpendPanel` — per-provider breakdown, daily budget progress, admin action buttons (Create User, Manage Users, Reload Config, Trigger Screener)
- `LoginPage` + `AuthContext` — JWT in memory, auto-refresh

**Milestone:** Dashboard opens in browser. Agent cards show live states (ACTIVE while pipeline runs). MissionPanel shows active tool calls updating. SpendPanel shows correct cost figures.

---

### Day 7 — Seed + E2E Tests + Pulumi + Demo Rehearsal

- `prisma/seed.ts` — complete seed per §14
- E2E tests (msw for external mocking): auth flow, full mission pipeline, Telegram commands
- `infra/pulumi/index.ts` — Fargate tasks, RDS Postgres 16, ElastiCache Redis 7, ECR repos, ALB
- README — architecture overview, 5-min quick-start, env var reference
- Cold-start test: `git clone → cp .env.example .env → docker compose up -d → pnpm seed` → system running in < 5 min
- Full demo rehearsal — all 5 scenes timed. Fix rough edges.

---

## 17. Demo Script — 5 Scenes, 15 Minutes

### Scene 1 — Mission Control + Model Routing (2 min)

Log into the admin dashboard. Show fullscreen:
- **Agent Floor** (Col 1): 9 cards, all idle. Each card shows model + provider. Manager: `claude-sonnet · anthropic`. Reporter: `llama-3.2-8b · lmstudio · $0.000`.
- **SystemHealth** (Col 3): all 12 services green. LM Studio ✓. KB: 47 entries, 1 contradiction.
- **SpendPanel** (Col 4): Today $0.00 / $5.00 budget.

Open terminal: show `config/runtime/agents.yaml` — model assignments as readable YAML.

> *"This is the mission control desk — admin only. Users interact entirely through Telegram. Each agent card shows its model, its provider, its today's cost. Manager and Analyst use Claude for deep reasoning. Researcher and Technician use GPT-4o for data collection. Reporter uses the local model on my GPU — free, zero API cost. Azure OpenAI is the enterprise fallback. All of this is in a YAML file mounted into the containers. Change a model name, restart the service — no rebuild."*

---

### Scene 2 — Live Investigation + Observability (4 min)

Pick up phone. Send `/compare NVDA AMD` from Telegram.

Watch the **Agent Floor** live:
- Manager → active: "comparison — NVDA, AMD"
- Researcher → active (twice, parallel): "Fetching NVDA data" / "Fetching AMD data" — token count climbing
- **MissionPanel** (Col 2): pipeline view shows tool calls firing under Researcher: `get_ohlcv ✓`, `get_fundamentals ✓`, `get_analyst_ratings ✓`, `get_ticker_news ↻` (spinner), `sharepoint_search · pending`
- Analyst → queued, then active
- Bookkeeper → active. KB entry count in SystemHealth ticks up.
- Reporter → active briefly. Telegram receives comparison reply.

Click LangSmith link in MissionLog → full parallel call tree with timings.

> *"Two Researcher jobs fired in parallel — one per ticker — using Vercel AI SDK parallel tool dispatch. You can see every MCP tool call: market-data, news, the enterprise connector SharePoint search. In production that's real Microsoft Graph. Here: realistic mock data. Agent code identical either way. Every step in LangSmith: model, tokens, duration. This is production observability."*

---

### Scene 3 — Contradiction Detection + Living KB (3 min)

Send `/thesis NVDA` — current bullish thesis arrives in Telegram.

Send `/history NVDA` — 4 snapshots returned, one labelled `⚡ contradiction` (from seed data, -4d).

Send `/devil NVDA` from Telegram.

Watch Agent Floor: Manager → Researcher → Analyst (devil_advocate mode) → Bookkeeper → Reporter.

SystemHealth (Col 3): KB entry count ticks up. Pending alerts count increments to 2.

Telegram receives reply labelled `⚠️ DEVIL'S ADVOCATE`.

> *"The Bookkeeper is the only agent that writes to the knowledge base. Before every write, it runs a structured LLM call comparing the incoming analysis against the existing thesis. When it detects a material conflict, it creates an alert and snapshots the previous version before overwriting. The operator is always informed. This is the KB as a living, auditable history — not just a search index."*

Send `/history NVDA` again — 5 snapshots now. The new `devil_advocate` entry is labelled.

---

### Scene 4 — MCP Architecture + Everything-as-Code (3 min)

Open terminal: `docker ps` — 12 containers. Point to the 6 MCP servers.

Open browser tab: `http://localhost:3005/mcp/tools` — enterprise-connector manifest renders. Show tool names, descriptions, JSON input schemas.

Open `researcher.ts` in editor — show the 6 lines registering all MCP servers as Vercel AI SDK tools.

> *"Six independent Hono services. The Researcher doesn't know how data is fetched. Add a new data source: write a new MCP server, add its URL to mcp.yaml. Zero changes to agent code. That's the pluggable architecture the position requires."*

Click **"Trigger Screener"** button in SpendPanel AdminTools. Screener card → active on the Agent Floor. ~20 seconds → idle. MissionLog gets a new `screener_scan` entry.

Send `/screener show last` from Telegram — same results arrive as formatted message.

> *"The Screener runs at 07:00 every weekday. It finds things you didn't know to look for. Results accessible from Telegram instantly. Admin can also trigger manually — shown here."*

---

### Scene 5 — Trader + IaC (3 min)

Type `/pattern NVDA 3w` in Telegram. Watch: Technician card → active. ~12 seconds → idle. Reporter briefly active.

Telegram receives: RSI value, MACD signal, Bollinger position, support/resistance, 2-sentence summary.

> *"Technician is completely separate from Analyst — different model, different tools, different output shape. Technical and fundamental analysis are cleanly decoupled."*

Type `/trade NVDA buy 10`. Trader card → active. SystemHealth: pending tickets increments to 1.

Telegram: `🎫 Trade ticket TKT-001 created — NVDA buy 10. Pending approval.`

Type `/approve TKT-001`.

Telegram: `✅ TKT-001 approved. Mock execution: NVDA 10 shares @ $487.23 (simulated, ±0.05% slippage).`

SystemHealth: pending tickets → 0.

> *"The system never trades autonomously. Trader prepares. Humans approve — from a phone, in seconds. Human-in-the-loop where it matters."*

Show `infra/pulumi/index.ts` — Fargate task definitions, RDS, ElastiCache.

> *"12 containers in Docker Compose today. `pulumi up` moves them to AWS Fargate with managed Postgres and Redis. Everything-as-Code: YAML config, prompts, infrastructure, migrations, seed script. Nothing hardcoded anywhere."*

---

## 18. Demo Checklist

**Evening before:**
- [ ] `docker compose up -d` — all 12 containers healthy (`docker ps`)
- [ ] Windows laptop: LM Studio running, `llama-3.2-8b` loaded (fits in 12GB VRAM)
- [ ] `pnpm seed` — admin + analyst users, 6 tickers, PDFs ingested, NVDA thesis + 4 snapshots, Screener run seeded
- [ ] GitHub Actions self-hosted runner active (GitHub → Settings → Actions → Runners)

**Morning of — verify each:**
- [ ] Dashboard loads — all 9 agent cards IDLE
- [ ] SystemHealth: all 12 services green, LM Studio ✓, Telegram ✓
- [ ] SystemHealth: KB 47 entries, 1 contradiction, 1 alert pending (earnings_approaching NVDA)
- [ ] Telegram: `/help` returns command list
- [ ] Telegram: morning brief already delivered (06:00 auto-run or manual trigger)
- [ ] Telegram: `/thesis NVDA` returns bullish thesis
- [ ] Telegram: `/history NVDA` returns 4 snapshots including `⚡ contradiction`
- [ ] Test: `/pattern NVDA 3w` → reply arrives < 15s, Technician card went ACTIVE then IDLE
- [ ] Test: `/trade NVDA buy 10` → `/approve TKT-001` → mock execution → pending count → 0
- [ ] Test: Trigger Screener button → Screener goes ACTIVE then IDLE, MissionLog updates

**Tabs open before demo:**
- [ ] Tab 1: Admin dashboard (fullscreen)
- [ ] Tab 2: LangSmith project
- [ ] Tab 3: `http://localhost:3005/mcp/tools`

**Editor windows open:**
- [ ] `config/runtime/agents.yaml` — Scene 1
- [ ] `apps/api/src/agents/researcher.ts` — MCP registration visible — Scene 4
- [ ] `infra/pulumi/index.ts` — Scene 5
- [ ] Terminal: `docker ps` output — Scene 4

---

*End of CASE.md — FinSight AI Hub v4.4*
