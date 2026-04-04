# Technology Stack

Locked stack for FinSight.

| Layer | Technology |
|---|---|
| Runtime | Python 3.13 |
| Workspace | uv workspaces |
| API | FastAPI |
| Validation | Pydantic v2 + pydantic-settings |
| ORM + Migrations | SQLAlchemy 2.x async + Alembic |
| Database | PostgreSQL + pgvector |
| Queue | Celery + Redis |
| Agent Orchestration | LangGraph |
| Tool Protocol | FastMCP |
| RAG | LangChain + pgvector |
| Dashboard | Dash (Plotly) |
| Bot | python-telegram-bot v20 |
| Observability | LangSmith + structlog |
| IaC | Pulumi (Python) |
| Containers | Docker / Podman |
| Testing | pytest + respx + pytest-asyncio |
| Lint/Type | ruff + mypy --strict |
