"""Invariant tests for operational shell scripts."""

from __future__ import annotations

from pathlib import Path


def _read(path: str) -> str:
    return Path(path).read_text(encoding="utf-8")


def test_deploy_script_keeps_migration_before_restart() -> None:
    script = _read("scripts/deploy.sh")
    migration_idx = script.index("docker compose run --rm api uv run alembic upgrade head")
    restart_idx = script.index("docker compose up -d --build")
    assert migration_idx < restart_idx
    assert "Migration failed. Aborting deployment. Services NOT restarted." in script


def test_deploy_script_requires_server_env_vars() -> None:
    script = _read("scripts/deploy.sh")
    assert 'missing+=("SERVER_HOST")' in script
    assert 'missing+=("SERVER_USER")' in script
    assert 'missing+=("SERVER_PATH")' in script
    assert 'missing+=("SERVER_SSH_KEY")' in script
    assert 'if [[ "${SERVER_SSH_KEY}" == "~/"* ]]; then' in script


def test_logs_script_has_service_validation_and_alias() -> None:
    script = _read("scripts/logs.sh")
    assert "VALID_SERVICES=(" in script
    assert "market-data-mcp" in script
    assert "news-macro-mcp" in script
    assert "rag-retrieval-mcp" in script
    assert 'if [[ "${SERVICE_NAME}" == "postgres" ]]; then' in script
    assert "Unknown service" in script
