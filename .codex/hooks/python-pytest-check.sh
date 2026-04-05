#!/bin/bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
tmp_root="$repo_root/.cache"
run_id="$(date +%Y%m%d%H%M%S)-$$"
base_tmp="$tmp_root/pytest-runs/$run_id"
cache_dir="$tmp_root/pytest-cache"
mkdir -p "$tmp_root/uv" "$tmp_root/pycache" "$base_tmp" "$cache_dir"

export UV_CACHE_DIR="$tmp_root/uv"
export PYTHONPYCACHEPREFIX="$tmp_root/pycache"

echo "[codex-hook] pytest"
cd "$repo_root"
uv run pytest --basetemp="$base_tmp" -o cache_dir="$cache_dir"

echo "[codex-hook] ok"
