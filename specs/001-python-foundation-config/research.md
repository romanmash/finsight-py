# Research: Foundation & Config

**Feature**: `001-python-foundation-config` | **Date**: 2026-04-02

## Technology Decisions

### Monorepo Management: uv workspaces

**Decision**: Use `uv` workspaces with a root `pyproject.toml` declaring each sub-package as a
workspace member.

**Rationale**: `uv` is the locked stack choice. Workspace support means a single `uv sync` installs
all packages and their cross-dependencies. Each sub-package (`packages/shared`, `apps/api-service`, etc.)
declares its own dependencies; `uv` resolves a single lock file for the whole workspace.

**Key pattern**:
```toml
[tool.uv.workspace]
members = ["packages/shared", "apps/api-service", "apps/mcp-servers/*", "apps/dashboard", "apps/telegram-bot"]
```

Each member is also a `tool.uv.sources` entry so cross-package imports work as editable installs:
```toml
[tool.uv.sources]
finsight-shared = { workspace = true }
```

### Configuration Loading: Pydantic v2 Settings + PyYAML

**Decision**: Use `pydantic-settings` with a custom `BaseSettings` subclass that reads `.env` for
secrets and a separate YAML loader for runtime config. YAML files are loaded with `PyYAML`, then
passed into Pydantic v2 models for validation.

**Rationale**: Pydantic v2 Settings natively handles `.env` and environment variable injection. For
YAML config files, the pattern is: `yaml.safe_load(path.read_text())` → `Model(**data)`. This keeps
secret values (from `.env`) strictly separate from behavioral config (YAML). Any Pydantic
`ValidationError` becomes a `sys.exit(1)` call with the error message.

**YAML loader**:
```python
import yaml
from pathlib import Path
from pydantic import BaseModel, ValidationError
import sys

def load_yaml_config(path: Path, model: type[BaseModel]) -> BaseModel:
    try:
        raw = yaml.safe_load(path.read_text())
        return model.model_validate(raw)
    except ValidationError as exc:
        sys.exit(f"Config error in {path}: {exc}")
    except yaml.YAMLError as exc:
        sys.exit(f"YAML parse error in {path}: {exc}")
```

**Alternative considered**: Dynaconf — rejected because it adds an extra abstraction layer and
the Pydantic-native pattern is already in the locked stack.

### Structured Logging: structlog

**Decision**: Use `structlog` with JSON renderer for all startup and runtime events.

**Rationale**: `structlog` is in the locked stack. Configure it once at startup with
`structlog.configure(processors=[..., structlog.processors.JSONRenderer()])`.

### Database Migrations: Alembic

**Decision**: Alembic with async SQLAlchemy engine, targeting PostgreSQL 16 + pgvector.

**Rationale**: Alembic is the industry standard for SQLAlchemy migrations. The `env.py` uses
`run_async_migrations()` to work with async engines. The `alembic.ini` `sqlalchemy.url` is
overridden at runtime from the environment variable `DATABASE_URL`.

### Docker Compose: Version 3.8+

**Decision**: Single `docker-compose.yml` at repo root covering all ~10 containers.

**Rationale**: One Compose file is simplest for a personal tool. Services: `db` (postgres:16 with
pgvector), `redis`, `api`, `market-data-mcp`, `news-macro-mcp`, `rag-retrieval-mcp`, `dashboard`,
`telegram-bot`, `worker-watchdog`, `worker-brief`. Dev override in `docker-compose.dev.yml` enables
volume mounts for live reload.

### Test Configuration: pytest + pytest-asyncio

**Decision**: Root `conftest.py` with `asyncio_mode = "auto"`. Config fixtures use `tmp_path` and
in-memory env injection via `monkeypatch`. No Docker, no network in any test.

**Rationale**: `pytest-asyncio` with `auto` mode removes the need for `@pytest.mark.asyncio` on
every test. `monkeypatch.setenv` replaces real environment variables so config tests are hermetic.

## Resolved Questions

| Question | Resolution |
|----------|------------|
| Extra `.env` vars | Silently ignored — `pydantic-settings` `extra = "ignore"` |
| Missing `config/runtime/` | `sys.exit(1)` with a clear message listing the expected directory |
| YAML parse errors | Caught at load time, `sys.exit(1)` before any service starts |
| pgvector local | `pgvector/pgvector:pg16` Docker image includes the extension |
| Python version | 3.13 (per constitution) — `uv` pins via `.python-version` |
