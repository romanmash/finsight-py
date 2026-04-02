# FinSight AI Hub — Technology Stack Decisions

**Document type:** Architecture Decision Record (ADR) — permanent reference
**Created:** 2026-04-02
**Last updated:** 2026-04-02
**Status:** Locked (changes require constitution amendment)

This document records every technology choice for the Python-first FinSight stack, with the
reasoning behind each decision. The goal is that any developer (or AI agent) reading this
can understand not just *what* is used, but *why*, and *what was rejected and why*.

---

## Runtime

### Python 3.13

**Chosen over:** Python 3.12, Python 3.14

Python 3.13 (released October 2024) is the current enterprise standard as of early 2026.
It ships with meaningful GIL improvements (experimental no-GIL mode), better error messages,
and improved async performance — all relevant to an agent-heavy async system.

- **Why not 3.12:** Still fully supported, but 3.13 is strictly better with no regression risk.
- **Why not 3.14:** Released October 2025, only 6 months old by project start. Enterprise
  libraries (SQLAlchemy, Celery, LangChain) typically take 3–6 months post-release to fully
  certify on a new Python version. 3.14 has unknown library compatibility gaps. For a system
  intended to actually run and be relied upon, 3.13 is the safer choice. 3.14 can be adopted
  once the ecosystem catches up (~late 2026).

**Type checking:** `mypy --strict` (zero tolerance for untyped `Any`). Strict typing is a
non-negotiable learning goal — it forces disciplined Python that transfers to enterprise codebases.

---

## Package Management & Monorepo

### uv workspaces

**Chosen over:** pip + venv, Poetry, PDM, pipenv, pnpm (TypeScript equivalent)

`uv` (by Astral) is the fastest Python package manager as of 2025, written in Rust. It replaces
pip, venv, pip-tools, and virtualenv in one tool. `uv workspaces` provides monorepo support
comparable to pnpm workspaces (what this project used in its TypeScript version).

- **Why not Poetry:** Slower, more complex lockfile, workspace support is weaker.
- **Why not pip:** No lockfile, no workspace support, no dependency resolution beyond basic.
- **Why uv:** 10–100x faster than pip, first-class workspace support, PEP 517/518 compliant,
  becoming the enterprise standard rapidly. Already used at major Python shops.

**Monorepo structure enabled by uv workspaces:**
- `packages/shared/` — domain types (Pydantic models), zero external dependencies
- `apps/api/` — FastAPI app + agents + Celery workers
- `apps/mcp-servers/` — 3 independent FastMCP servers
- `apps/dashboard/` — Dash operator console
- `apps/telegram-bot/` — Telegram bot

---

## API Framework

### FastAPI

**Chosen over:** Flask, Django REST Framework, Litestar, Sanic, aiohttp

FastAPI is the dominant Python API framework for AI and data engineering applications as of 2026.
It is async-native, generates OpenAPI documentation automatically, uses Pydantic for request/
response validation natively, and has exceptional developer experience.

- **Why not Flask:** Synchronous by default (though async extensions exist), no auto OpenAPI,
  no native Pydantic integration. Flask is legacy for new projects.
- **Why not Django REST Framework:** Heavy, ORM-coupled, designed for monolithic apps. Adds
  Django's entire ORM and template system as overhead.
- **Why not Litestar:** Excellent technical framework but smaller ecosystem, fewer tutorials,
  less job-description coverage than FastAPI.
- **Why FastAPI:** #1 Python web framework in job postings for AI/ML and backend roles. Used at
  Netflix, Uber, Microsoft. Native async, native Pydantic, auto OpenAPI, dependency injection
  system that makes authentication and RBAC clean to implement. This is what an interviewer
  expects to see for a Python backend role.

---

## ORM & Database

### SQLAlchemy 2.x async + Alembic + pgvector

**Chosen over:** Prisma (Python client), Tortoise ORM, Peewee, raw asyncpg, Django ORM

SQLAlchemy 2.x introduced a fully async-native API (using `async_sessionmaker`, `AsyncSession`)
that works seamlessly with FastAPI's async architecture. Alembic is SQLAlchemy's official
migration tool.

- **Why not Prisma Python client:** Prisma Python client is experimental (JavaScript Prisma is
  mature, Python port lags significantly). Not production-ready for this use case.
- **Why not Tortoise ORM:** Smaller ecosystem, fewer enterprise users, less support for
  complex queries and pgvector extensions.
- **Why not raw asyncpg:** Maximum performance but requires writing all SQL manually. No type
  safety, no migration management, much higher maintenance burden.
- **Why SQLAlchemy:** The enterprise Python ORM. Used at every major Python shop. Appears in
  virtually every Python backend job description. SQLAlchemy 2.x's declarative mapped classes
  with full type annotation support makes it as ergonomic as Prisma while being far more
  powerful and production-proven.

**pgvector:** The PostgreSQL extension for vector similarity search. Required for the RAG
knowledge base. Native support via `pgvector` Python package + SQLAlchemy column type.

**Alembic:** SQLAlchemy's official migration tool. Version-controlled, reversible, auto-generates
migration scripts from model changes. The Python equivalent of Prisma Migrate.

---

## Task Queue & Scheduling

### Celery + Redis 7

**Chosen over:** ARQ, Dramatiq, RQ (Redis Queue), APScheduler, BullMQ (TypeScript equivalent)

Celery is the enterprise-standard Python distributed task queue. It is in virtually every Python
job description that involves background processing.

- **Why not ARQ:** ARQ is async-native and more modern, but has a much smaller ecosystem,
  fewer enterprise deployments, and less job-description coverage. Would be a good choice for
  a green-field async project prioritising elegance over familiarity.
- **Why not RQ (Redis Queue):** Simpler than Celery, but lacks Celery's scheduling (Celery Beat),
  canvas primitives (chains, groups), and monitoring ecosystem.
- **Why not APScheduler:** Scheduling only — no distributed worker, no retry logic, no monitoring.
  Suitable for simple cron jobs, not for a multi-agent task pipeline.
- **Why Celery:** Ubiquitous in enterprise Python. Supports scheduled tasks (Celery Beat),
  task chaining, retry policies, dead letter handling, and has excellent monitoring via Flower.
  The knowledge transfers directly to enterprise roles. Redis is the broker (same Redis instance
  used for caching).

---

## Agent Orchestration

### LangGraph (Python)

**Chosen over:** LangChain agents, CrewAI, AutoGen, Vercel AI SDK (TypeScript, replaced),
direct LLM calls with manual routing

LangGraph is the production-grade multi-agent orchestration framework from the LangChain team.
It models agent workflows as stateful directed graphs with explicit nodes (agents) and edges
(routing logic). The supervisor pattern (one Manager node routing to specialist nodes) is a
first-class LangGraph pattern.

- **Why not LangChain agents:** LangChain's agent executors are less structured and harder to
  debug. LangGraph *is* the recommended path from LangChain team for production multi-agent.
- **Why not CrewAI:** Higher-level abstraction that hides the graph structure. Good for demos,
  but less controllable for a system where agent boundaries and observability matter.
- **Why not AutoGen:** Microsoft's framework, more research-oriented, less production tooling.
- **Why not direct LLM calls:** The TypeScript version used direct `generateText` calls. This
  works but lacks: checkpointing (state recovery after restart), built-in retry logic,
  supervisor routing patterns, and native LangSmith integration.
- **Why LangGraph:** Explicit, inspectable, production-grade. Every node is a Python function.
  Every edge is a routing decision you control. State is checkpointed automatically. Native
  LangSmith integration. This is what enterprise AI engineering looks like in 2025–2026.

**LangChain (narrowly):** Used for document chunking (`RecursiveCharacterTextSplitter`),
embedding abstraction (`OpenAIEmbeddings`), and retrieval chains in the RAG layer only.
Not for agent orchestration — that is LangGraph's job exclusively.

---

## Finance Data

### OpenBB Platform SDK

**Chosen over:** yfinance, direct Finnhub SDK, direct FMP SDK, direct Alpha Vantage SDK,
multiple separate provider SDKs

OpenBB Platform is the unified Python API for financial data, with 63k+ GitHub stars and
actively maintained as of 2026. It abstracts over dozens of data providers (Yahoo Finance,
Finnhub, FMP, Alpha Vantage, EODHD, and more) under one consistent Python interface.

- **Why not yfinance:** Unofficial Yahoo Finance scraper. Fragile, frequently breaks, no
  enterprise support, limited data types.
- **Why not multiple direct SDKs:** The TypeScript version used Finnhub + FMP + Alpha Vantage
  separately. Each SDK has different error handling, rate limiting, response shapes, and
  authentication. OpenBB unifies all of this.
- **Why OpenBB:** One API for stocks, ETFs, fundamentals, options chains, earnings, insider
  trades, macro data. Provider switching (from yfinance to Finnhub, for example) is a one-line
  config change. Built-in data normalisation. Python-first, actively maintained, growing
  enterprise adoption.

**Additional sources inside MCP servers:**
- `news-macro-mcp`: Finnhub (real-time news + sentiment), GDELT (geopolitical signals)
- These are used directly where OpenBB's news coverage is insufficient for the specific data type.

---

## MCP Tool Servers

### FastMCP (3 servers)

**Chosen over:** 6 Hono microservices (TypeScript, replaced), custom REST APIs, direct tool
functions inside agents

FastMCP is the Python-native MCP (Model Context Protocol) server framework. MCP is the emerging
standard protocol for exposing tools to LLM agents, developed by Anthropic.

- **Why MCP at all:** MCP decouples data retrieval from agent logic. Agents call tools by name;
  they don't import data SDKs directly. This enforces the agent boundary principle and makes
  each data source independently cacheable, testable, and replaceable.
- **Why 3 servers instead of 6:** The TypeScript version had 6 Hono servers (one per data source
  type). Reducing to 3 thematic servers (market-data, news-macro, rag-retrieval) reduces
  operational complexity while preserving the architectural pattern. Each server still has its
  own health endpoint, cache namespace, and process boundary.
- **Why FastMCP over custom REST:** FastMCP auto-generates the tool manifest and invocation
  protocol. Less boilerplate than custom REST endpoints with the same architectural benefits.

---

## RAG Pipeline

### LangChain Python + pgvector

**Chosen over:** LlamaIndex, custom embedding + retrieval code, Pinecone, ChromaDB, Weaviate

LangChain Python is the primary runtime for LangChain (the JavaScript version was used in the
TypeScript project but Python is the canonical version). pgvector stores embeddings in the same
PostgreSQL database as all other data.

- **Why not LlamaIndex:** Also excellent for RAG, but LangChain is more widely taught and
  appears in more job descriptions. Either would work technically.
- **Why not Pinecone/Weaviate/ChromaDB:** Separate vector databases add operational complexity
  (another service to run, another connection to manage). pgvector in PostgreSQL means one
  database for all data, including vectors. Works at the scale this project needs.
- **Why LangChain for RAG:** `RecursiveCharacterTextSplitter` for chunking, `OpenAIEmbeddings`
  for provider-agnostic embeddings, retrieval chains for combining similarity search with
  metadata filtering. All standard tools in enterprise Python RAG pipelines.

---

## Observability

### LangSmith + structlog

**Chosen over:** LangFuse, custom logging, Pino (TypeScript, replaced), plain Python logging

LangSmith provides full LLM call tracing — every prompt, response, token count, and latency
is recorded as a linked trace. It is the native observability platform for LangChain/LangGraph
and requires minimal integration code.

- **Why LangSmith:** First-class LangGraph integration. Traces are automatically linked across
  the supervisor graph. Cost and latency visible per agent, per mission, per model.
- **Why structlog:** Python's best structured logging library. Produces JSON log lines with
  context fields (request ID, agent name, mission ID) automatically bound to the logger.
  The Python equivalent of Pino. Appears in enterprise Python codebases.
- **Why not plain `logging`:** Python's built-in logging module produces unstructured text
  by default. structlog wraps it with structured key-value output, making logs parseable.

---

## Telegram Bot

### python-telegram-bot v20 (async)

**Chosen over:** Aiogram 3, Telegraf (TypeScript, replaced), Telethon, pyTelegramBotAPI

python-telegram-bot v20 introduced a fully async API (`Application`, `CommandHandler`,
`MessageHandler`) that integrates naturally with Python's asyncio and FastAPI.

- **Why not Aiogram 3:** Technically superior (more modern, cleaner API), but smaller ecosystem,
  fewer tutorials, lower job-description coverage than python-telegram-bot.
- **Why not pyTelegramBotAPI:** Synchronous by default. Does not fit an async architecture.
- **Why python-telegram-bot:** The most widely documented Python Telegram library. Most Stack
  Overflow answers, most tutorials, most enterprise examples. v20's async API is clean and
  integrates directly with asyncio. Better choice for learning purposes.

**Voice support:** Telegram voice messages (OGG format) are downloaded and sent to the
**Whisper API** (OpenAI) for transcription. The transcription text is then processed as a
normal text query. Whisper is the industry standard for speech-to-text in 2025–2026.

---

## Operator Dashboard

### Dash (Plotly)

**Chosen over:** Streamlit, Gradio, Panel, React + Vite (TypeScript, replaced), Grafana

Dash (by Plotly) is the enterprise-standard Python framework for data dashboards and internal
operations tools. Used at Bloomberg, hedge funds, banks, and data engineering teams worldwide.

- **Why not Streamlit:** Streamlit is excellent for quick data science demos but has limited
  layout control and is not designed for complex interactive applications with multiple views,
  forms, and real-time updates. Touch support is poor.
- **Why not Gradio:** Primarily for ML model demos. Not suited for an ops console with
  mission management, watchlist editing, and knowledge base browsing.
- **Why not Grafana:** Metrics and monitoring dashboards, not general application UIs. Cannot
  build the mission detail view, watchlist editor, or knowledge browser in Grafana.
- **Why not React + Vite:** The TypeScript version used React. Replacing it with Python means
  the entire codebase stays in one language. The operator console does not need React's
  component ecosystem — Dash's layout and callback model is sufficient and Python-native.
- **Why Dash:** Full layout control, callback-based interactivity (equivalent to React's event
  handlers), Plotly charts for market data visualisation, component library for forms and
  tables. Touch target sizing is configurable. Used in production financial dashboards at real
  institutions. Appears in data engineering and quant developer job descriptions.

---

## Infrastructure as Code

### Pulumi Python

**Chosen over:** Terraform, AWS CDK (Python), Pulumi TypeScript (replaced), CloudFormation

Pulumi allows infrastructure to be defined in Python using the same language as the rest of the
project. No HCL (Terraform's domain-specific language) to learn separately.

- **Why not Terraform:** HCL is a separate language. For a Python-learning project, keeping
  everything in Python is a clear win.
- **Why not AWS CDK Python:** AWS-only. Pulumi is multi-cloud.
- **Why Pulumi:** Python-native, multi-cloud, same toolchain as the rest of the project.
  Infrastructure changes are code-reviewed like any other change.

---

## Configuration Validation

### Pydantic v2 Settings + YAML

**Chosen over:** Zod (TypeScript, replaced), Dynaconf, Python-dotenv only, dataclasses

Pydantic v2 is the industry standard for Python data validation and settings management.
`pydantic-settings` provides a `BaseSettings` class that reads from environment variables and
validates types automatically.

- **Why not Zod:** TypeScript-only. Replaced.
- **Why not Dynaconf:** Excellent tool but Pydantic is more widely used and integrates
  directly with FastAPI's dependency injection.
- **Why Pydantic v2:** v2 was a complete rewrite (10–50x faster than v1, using Rust under the
  hood). It is the standard for Python API development, agent output schemas, config validation,
  and data modelling. Every FastAPI project uses Pydantic. Every LangChain output parser uses
  Pydantic. Learning Pydantic v2 thoroughly is a high-value enterprise skill.

**YAML config files** (validated by Pydantic schemas at startup):
- `agents.yaml` — model assignments, provider fallbacks, retry policy
- `mcp.yaml` — MCP server addresses, tool cache TTLs
- `watchdog.yaml` — thresholds, deduplication window, monitoring frequency
- `pricing.yaml` — per-token costs by model (for deterministic cost tracking)
- `schedules.yaml` — cron expressions for Celery Beat tasks

---

## Testing

### pytest + respx + pytest-asyncio

**Chosen over:** unittest, Hypothesis (property testing), msw (TypeScript, replaced)

- **pytest:** The universal Python test runner. Fixtures, parametrize, plugins. Every Python
  project uses pytest. The enterprise standard.
- **respx:** Async HTTP mocking for httpx (FastAPI's test client uses httpx). Equivalent to
  `msw` (the TypeScript mock service worker) — intercepts HTTP calls at the transport layer
  without requiring code changes in the system under test.
- **pytest-asyncio:** Makes async test functions work with pytest without boilerplate.

All tests must pass offline (no network, no Docker, no running database). External HTTP calls
are mocked with respx. Database calls use an in-process SQLite fixture or an async test
PostgreSQL session with transaction rollback.

---

## Containers

### Docker (production server) + Podman (dev laptop)

**Unchanged from TypeScript version.** Both are OCI-compatible. The same `docker compose`
files work with both (`docker` on the dev laptop is proxied to Podman via a Docker-compatible
socket). No changes required.

---

## What This Stack Teaches

Every technology in this stack appears regularly in enterprise Python and AI engineering job
descriptions. The learning value of each choice:

| Technology | What it teaches |
|---|---|
| Python 3.13 + mypy | Modern typed Python, discipline, enterprise code quality |
| FastAPI | API design, dependency injection, async Python, OpenAPI |
| SQLAlchemy 2.x + Alembic | ORM patterns, async DB, migration management |
| Celery + Redis | Distributed task queues, scheduling, retry patterns |
| LangGraph | Multi-agent systems, graph-based orchestration, state management |
| LangChain (RAG) | Document processing, embeddings, retrieval-augmented generation |
| OpenBB | Financial data APIs, provider abstraction, market data pipelines |
| FastMCP | MCP protocol, microservice tool servers, API contracts |
| LangSmith | LLM observability, trace analysis, cost monitoring |
| Pydantic v2 | Data validation, settings management, typed schemas |
| Dash (Plotly) | Python-native dashboard development, data visualisation |
| Pulumi Python | Infrastructure as Code, cloud resource management |
| uv workspaces | Modern Python monorepo management, dependency resolution |
| pytest + respx | Python testing patterns, async testing, HTTP mocking |
