#!/usr/bin/env bash
# update-context.sh — Codex CLI integration: create/update AGENTS.md
# Thin wrapper that delegates to the shared update-agent-context script.

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"

if [[ -z "$repo_root" || ! -d "$repo_root/.specify" ]]; then
  repo_root="$script_dir"
  while [[ "$repo_root" != "/" && ! -d "$repo_root/.specify" ]]; do
    repo_root="$(dirname "$repo_root")"
  done
fi

exec "$repo_root/.specify/scripts/bash/update-agent-context.sh" codex
