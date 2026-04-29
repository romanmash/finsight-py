# FinSight AI Hub — Specs Index

> **Methodology:** [Spec-Driven Development](https://github.com/github/spec-kit)
> **Constitution:** [`.specify/memory/constitution.md`](../.specify/memory/constitution.md)
> **Stack:** Python 3.13 · FastAPI · LangGraph · SQLAlchemy · Celery · OpenBB · Dash

## Feature Catalogue

Each feature directory contains three artifacts:

| Artifact | Purpose | Phase |
|---|---|---|
| `spec.md` | PRD — User stories, acceptance scenarios, requirements | Specify |
| `plan.md` | SDD — Technical design, file list, architecture decisions | Plan |
| `tasks.md` | Implementation checklist grouped by user story | Implement |

## Work in Progress

Implemented specs `001`-`012` document the original 9-agent design intent. In the current implementation, 7 specialist agents are active in production-facing flows, while `screener` and `trader` remain partially implemented (mock/scaffold level) and are still in progress.

## Build Order

Features are ordered by dependency. Implement them in sequence.

| # | Feature | Directory | Dependencies |
|---|---|---|---|
| 001 | Foundation & Config | [`001-python-foundation-config/`](./001-python-foundation-config/) | — |
| 002 | Data Layer | [`002-async-data-layer/`](./002-async-data-layer/) | 001 |
| 003 | API & Auth | [`003-api-jwt-auth/`](./003-api-jwt-auth/) | 001, 002 |
| 004 | MCP Platform | [`004-mcp-platform/`](./004-mcp-platform/) | 001, 002 |
| 005 | Agent Infrastructure | [`005-agent-infrastructure/`](./005-agent-infrastructure/) | 003, 004 |
| 006 | Collector Agents | [`006-collector-agents/`](./006-collector-agents/) | 004, 005 |
| 007 | Reasoning Agents | [`007-reasoning-agents/`](./007-reasoning-agents/) | 005, 006 |
| 008 | Orchestration | [`008-orchestration/`](./008-orchestration/) | 006, 007 |
| 009 | Telegram Bot & Voice | [`009-telegram-bot-voice/`](./009-telegram-bot-voice/) | 008 |
| 010 | Operator Dashboard | [`010-operator-dashboard/`](./010-operator-dashboard/) | 003, 008 |
| 011 | Seed & Infrastructure | [`011-seed-infrastructure/`](./011-seed-infrastructure/) | All above |
| 012 | Debug MCP Server | [`012-debug-mcp-server/`](./012-debug-mcp-server/) | 004, 008, 011 |

## Stack Summary (Python-First)

| Layer | Technology |
|---|---|
| Runtime | Python 3.13 + mypy strict |
| API | FastAPI |
| ORM | SQLAlchemy 2.x async + Alembic + pgvector |
| Queue | Celery + Redis 7 |
| Agent Orchestration | LangGraph Python (supervisor graph) |
| Finance Data | OpenBB Platform SDK |
| MCP Servers (3) | FastMCP — market-data, news-macro, rag-retrieval |
| RAG | LangChain Python + pgvector |
| Observability | LangSmith + structlog |
| Bot | python-telegram-bot v20 + Whisper API (voice) |
| Dashboard | Dash (Plotly) |
| IaC | Pulumi Python |
| Monorepo | uv workspaces |
| Testing | pytest + respx + pytest-asyncio |
