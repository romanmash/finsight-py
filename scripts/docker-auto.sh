#!/usr/bin/env bash
set -euo pipefail

if command -v docker >/dev/null 2>&1; then
  exec docker "$@"
fi

if command -v docker.exe >/dev/null 2>&1; then
  exec docker.exe "$@"
fi

echo "docker not found. Install Docker CLI in WSL or enable docker.exe bridge from Windows." >&2
exit 127
