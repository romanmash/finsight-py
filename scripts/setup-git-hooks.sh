#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

git config core.hooksPath .githooks

mkdir -p .cache/uv .cache/pycache

echo "Configured git hooksPath=.githooks"
echo "Windows-native hooks ready: .githooks/pre-commit.cmd and .githooks/pre-push.cmd"
echo "Local cache directories ready: .cache/uv and .cache/pycache"
echo "Set these in your shell profile to keep caches under .cache:"
echo "  export UV_CACHE_DIR=\"$repo_root/.cache/uv\""
echo "  export PYTHONPYCACHEPREFIX=\"$repo_root/.cache/pycache\""
