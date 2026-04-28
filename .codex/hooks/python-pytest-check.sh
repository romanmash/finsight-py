#!/bin/bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cache_root="$repo_root/.cache"
run_id="$(date +%Y%m%d%H%M%S)-$$"
base_tmp="$cache_root/pytest-runs/$run_id"
cache_dir="$cache_root/pytest-cache"
mkdir -p "$cache_root/pycache" "$base_tmp" "$cache_dir"

uname_lower="$(uname -s | tr '[:upper:]' '[:lower:]')"
if [[ "$uname_lower" == mingw* || "$uname_lower" == msys* || "$uname_lower" == cygwin* ]]; then
  uv_cache_dir="$cache_root/uv-win"
else
  uv_cache_dir="$cache_root/uv-linux"
fi
mkdir -p "$uv_cache_dir"
export UV_CACHE_DIR="$uv_cache_dir"
export PYTHONPYCACHEPREFIX="$cache_root/pycache"
export UV_LINK_MODE="copy"

if ! command -v uv >/dev/null 2>&1; then
  echo "[codex-hook] uv not found on PATH. Run: source \"$HOME/.local/bin/env\"" >&2
  exit 127
fi

ensure_env_ready() {
  if uv run --no-sync --all-packages --group dev python -c "import fastapi, sqlalchemy, pydantic" >/dev/null 2>&1; then
    return 0
  fi

  echo "[codex-hook] .venv is missing required packages. Running uv sync..." >&2
  if ! uv sync --all-packages --group dev >/dev/null 2>&1; then
    echo "[codex-hook] uv sync failed. Clearing uv cache and retrying once..." >&2
    rm -rf "$UV_CACHE_DIR"
    mkdir -p "$UV_CACHE_DIR"
    uv sync --all-packages --group dev --refresh >/dev/null 2>&1 || return 1
  fi

  uv run --no-sync --all-packages --group dev python -c "import fastapi, sqlalchemy, pydantic" >/dev/null 2>&1
}

if ! ensure_env_ready; then
  echo "[codex-hook] Could not prepare Python environment for hooks." >&2
  echo "[codex-hook] Run manually: uv sync --all-packages --group dev --refresh" >&2
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
