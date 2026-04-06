#!/bin/bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cache_root="$repo_root/.cache"
run_id="$(date +%Y%m%d%H%M%S)-$$"
base_tmp="$cache_root/pytest-runs/$run_id"
cache_dir="$cache_root/pytest-cache"
mkdir -p "$cache_root/pycache" "$base_tmp" "$cache_dir"

mkdir -p "$cache_root/uv"
export UV_CACHE_DIR="$cache_root/uv"
export PYTHONPYCACHEPREFIX="$cache_root/pycache"

if ! command -v uv >/dev/null 2>&1; then
  echo "[codex-hook] uv not found on PATH. Run: source \"$HOME/.local/bin/env\"" >&2
  exit 127
fi

if ! uv run --no-sync --all-packages --group dev python -c "import fastapi, sqlalchemy, pydantic" >/dev/null 2>&1; then
  echo "[codex-hook] .venv is missing required packages." >&2
  echo "[codex-hook] Run: uv sync --all-packages --group dev" >&2
  exit 1
fi

echo "[codex-hook] pytest"
cd "$repo_root"
if [[ -n "${PYTEST_ARGS:-}" ]]; then
  uv run --no-sync --all-packages --group dev pytest $PYTEST_ARGS --basetemp="$base_tmp" -o cache_dir="$cache_dir"
else
  uv run --no-sync --all-packages --group dev pytest --basetemp="$base_tmp" -o cache_dir="$cache_dir"
fi

echo "[codex-hook] ok"
