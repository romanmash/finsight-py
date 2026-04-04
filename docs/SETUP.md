# Local Setup

## Dev Laptop

- Windows 11 Pro
- Python 3.13
- uv
- LM Studio (optional local model endpoint)
- Podman Desktop (Docker-compatible CLI)

## Linux Server

- Ubuntu 24.04 Desktop
- Python 3.13
- uv
- Docker Engine + Docker Compose

## Bootstrap

```bash
uv sync
cp .env.example .env
uv run alembic upgrade head
uv run python -m scripts.seed
uv run pytest
```

## Quality Commands

```bash
uv run mypy --strict
uv run ruff check
uv run pytest
```
