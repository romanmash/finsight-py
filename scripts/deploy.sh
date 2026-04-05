#!/bin/bash
set -euo pipefail

# Run: bash scripts/deploy.sh
# deploy.sh: Sync repo to server, run migrations, then restart compose stack.
# Migration is intentionally executed before restart. If migration fails, services are not restarted.

usage() {
  cat <<'USAGE'
Usage: scripts/deploy.sh

Environment variables:
  SERVER_HOST            Required. Remote SSH host.
  SERVER_USER            Required. Remote SSH user.
  SERVER_PATH            Required. Remote deployment path.
  SERVER_SSH_KEY         Required. SSH private key path used by rsync/ssh.

Compatibility aliases:
  DEPLOY_HOST -> SERVER_HOST
  DEPLOY_USER -> SERVER_USER
  DEPLOY_PATH -> SERVER_PATH

Optional:
  HEALTHCHECK_URLS       Comma-separated HTTP endpoints (default: http://localhost:8000/health)
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ -f ".env" ]]; then
  # shellcheck disable=SC1091
  source ".env"
fi

SERVER_HOST="${SERVER_HOST:-${DEPLOY_HOST:-}}"
SERVER_USER="${SERVER_USER:-${DEPLOY_USER:-}}"
SERVER_PATH="${SERVER_PATH:-${DEPLOY_PATH:-}}"
SERVER_SSH_KEY="${SERVER_SSH_KEY:-}"
HEALTHCHECK_URLS="${HEALTHCHECK_URLS:-http://localhost:8000/health}"

if [[ "${SERVER_SSH_KEY}" == "~/"* ]]; then
  SERVER_SSH_KEY="${HOME}/${SERVER_SSH_KEY#~/}"
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

for tool in rsync ssh; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "[deploy] missing required tool: $tool" >&2
    exit 2
  fi
done

SSH_CMD=(ssh -i "${SERVER_SSH_KEY}" -o ConnectTimeout=10 "${SERVER_USER}@${SERVER_HOST}")
RSYNC_SSH="$(printf 'ssh -i %q -o ConnectTimeout=10' "${SERVER_SSH_KEY}")"

echo "[deploy] syncing repository to ${SERVER_USER}@${SERVER_HOST}:${SERVER_PATH}"
rsync -avz --exclude='.env' --exclude='__pycache__' --exclude='.git' \
  -e "${RSYNC_SSH}" \
  . "${SERVER_USER}@${SERVER_HOST}:${SERVER_PATH}"

echo "[deploy] running migrations before restart"
if ! "${SSH_CMD[@]}" "cd '${SERVER_PATH}' && docker compose run --rm api uv run alembic upgrade head"; then
  echo "Migration failed. Aborting deployment. Services NOT restarted." >&2
  exit 1
fi

echo "[deploy] restarting services"
"${SSH_CMD[@]}" "cd '${SERVER_PATH}' && docker compose up -d --build"

IFS=',' read -r -a urls <<< "${HEALTHCHECK_URLS}"
for url in "${urls[@]}"; do
  trimmed_url="$(echo "${url}" | xargs)"
  [[ -z "${trimmed_url}" ]] && continue
  echo "[deploy] health check ${trimmed_url}"
  "${SSH_CMD[@]}" "curl -sf '${trimmed_url}' >/dev/null"
done

echo "Deployment complete. All services healthy."
