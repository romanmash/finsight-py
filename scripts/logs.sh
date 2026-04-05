#!/bin/bash
set -euo pipefail

# Run: bash scripts/logs.sh <service>
# logs.sh: Stream logs for one named service from remote docker compose.

usage() {
  cat <<'USAGE'
Usage: scripts/logs.sh <service>

Arguments:
  service    Required. Docker Compose service name.

Environment variables:
  SERVER_HOST    Required. Remote SSH host.
  SERVER_USER    Required. Remote SSH user.
  SERVER_PATH    Required. Remote compose path.
  SERVER_SSH_KEY Required. SSH private key path.

Compatibility aliases:
  DEPLOY_HOST -> SERVER_HOST
  DEPLOY_USER -> SERVER_USER
  DEPLOY_PATH -> SERVER_PATH
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ $# -lt 1 ]]; then
  echo "[logs] missing required service argument" >&2
  usage
  exit 2
fi

if [[ -f ".env" ]]; then
  # shellcheck disable=SC1091
  source ".env"
fi

SERVICE_NAME="$1"
SERVER_HOST="${SERVER_HOST:-${DEPLOY_HOST:-}}"
SERVER_USER="${SERVER_USER:-${DEPLOY_USER:-}}"
SERVER_PATH="${SERVER_PATH:-${DEPLOY_PATH:-}}"
SERVER_SSH_KEY="${SERVER_SSH_KEY:-}"

if [[ "${SERVER_SSH_KEY}" == "~/"* ]]; then
  SERVER_SSH_KEY="${HOME}/${SERVER_SSH_KEY#~/}"
fi

VALID_SERVICES=(
  api
  celery-beat
  worker-mission
  worker-alert
  worker-screener
  worker-watchdog
  worker-brief
  telegram-bot
  telegram-worker
  dashboard
  db
  redis
  market-data-mcp
  news-macro-mcp
  rag-retrieval-mcp
)

if [[ "${SERVICE_NAME}" == "postgres" ]]; then
  SERVICE_NAME="db"
fi

if [[ ! " ${VALID_SERVICES[*]} " =~ " ${SERVICE_NAME} " ]]; then
  echo "Unknown service '${1}'. Valid services: ${VALID_SERVICES[*]}" >&2
  exit 1
fi

missing=()
[[ -z "${SERVER_HOST}" ]] && missing+=("SERVER_HOST")
[[ -z "${SERVER_USER}" ]] && missing+=("SERVER_USER")
[[ -z "${SERVER_PATH}" ]] && missing+=("SERVER_PATH")
[[ -z "${SERVER_SSH_KEY}" ]] && missing+=("SERVER_SSH_KEY")
if [[ ${#missing[@]} -gt 0 ]]; then
  echo "Missing required environment variables: ${missing[*]}" >&2
  exit 1
fi

if [[ ! -f "${SERVER_SSH_KEY}" ]]; then
  echo "SERVER_SSH_KEY does not exist: ${SERVER_SSH_KEY}" >&2
  exit 1
fi

echo "[logs] tailing ${SERVICE_NAME} on ${SERVER_USER}@${SERVER_HOST}"
ssh -i "${SERVER_SSH_KEY}" -o ConnectTimeout=10 "${SERVER_USER}@${SERVER_HOST}" \
  "cd '${SERVER_PATH}' && docker compose logs -f ${SERVICE_NAME}"
