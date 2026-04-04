#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
tmp_root="$repo_root/.cache"
run_id="$(date +%Y%m%d%H%M%S)-$$"
base_tmp="$tmp_root/pytest-runs/$run_id"
cache_dir="$tmp_root/pytest-cache"
mkdir -p "$tmp_root/uv" "$tmp_root/pycache" "$tmp_root/mypy" "$tmp_root/ruff" "$base_tmp" "$cache_dir"

export UV_CACHE_DIR="$tmp_root/uv"
export PYTHONPYCACHEPREFIX="$tmp_root/pycache"

echo "[codex-hook] ruff"
uv run ruff check --cache-dir "$tmp_root/ruff"

echo "[codex-hook] mypy"
uv run mypy --strict --cache-dir "$tmp_root/mypy"

echo "[codex-hook] pytest"
cd "$repo_root"
uv run pytest --basetemp="$base_tmp" -o cache_dir="$cache_dir"

echo "[codex-hook] ok"
