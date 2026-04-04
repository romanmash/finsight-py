#!/usr/bin/env bash
set -euo pipefail

# deploy.sh: Sync runtime artifacts and restart remote compose stack with health checks.
# Required env: DEPLOY_HOST, DEPLOY_USER. Optional env: DEPLOY_PATH, COMPOSE_PROJECT_NAME, HEALTHCHECK_URLS.

usage() {
  cat <<'USAGE'
Usage: scripts/deploy.sh

Environment variables:
  DEPLOY_HOST            Required. Remote SSH host.
  DEPLOY_USER            Required. Remote SSH user.
  DEPLOY_PATH            Optional. Remote path. Default: /opt/finsight
  COMPOSE_PROJECT_NAME   Optional. Default: finsight
  HEALTHCHECK_URLS       Optional. Comma-separated HTTP endpoints.
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

: "${DEPLOY_HOST:?DEPLOY_HOST is required}"
: "${DEPLOY_USER:?DEPLOY_USER is required}"

DEPLOY_PATH="${DEPLOY_PATH:-/opt/finsight}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-finsight}"
HEALTHCHECK_URLS="${HEALTHCHECK_URLS:-}"

for tool in rsync ssh; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "[deploy] missing required tool: $tool" >&2
    exit 2
  fi
done

echo "[deploy] syncing artifacts to ${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}"
rsync -az --delete \
  --exclude '.git/' \
  --exclude 'node_modules/' \
  --exclude '.env' \
  docker-compose.yml docker-compose.dev.yml pyproject.toml uv.lock "${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}/"

echo "[deploy] restarting compose stack"
ssh "${DEPLOY_USER}@${DEPLOY_HOST}" "cd ${DEPLOY_PATH} && docker compose pull && docker compose up -d"

if [[ -n "$HEALTHCHECK_URLS" ]]; then
  IFS=',' read -r -a urls <<< "$HEALTHCHECK_URLS"
  for url in "${urls[@]}"; do
    echo "[deploy] healthcheck $url"
    if ! curl -fsS --max-time 10 "$url" >/dev/null; then
      echo "[deploy] healthcheck failed: $url" >&2
      exit 3
    fi
  done
fi

echo "[deploy] success"
