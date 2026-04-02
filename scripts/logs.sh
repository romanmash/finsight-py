#!/usr/bin/env bash
set -euo pipefail

# logs.sh: Stream logs for one named service from the remote compose target.
# Required env: DEPLOY_HOST, DEPLOY_USER. Optional env: DEPLOY_PATH.

usage() {
  cat <<'USAGE'
Usage: scripts/logs.sh <service>

Arguments:
  service    Required. Docker Compose service name.

Environment variables:
  DEPLOY_HOST   Required. Remote SSH host.
  DEPLOY_USER   Required. Remote SSH user.
  DEPLOY_PATH   Optional. Remote compose path. Default: /opt/finsight
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

: "${DEPLOY_HOST:?DEPLOY_HOST is required}"
: "${DEPLOY_USER:?DEPLOY_USER is required}"

SERVICE_NAME="$1"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/finsight}"

echo "[logs] tailing ${SERVICE_NAME} on ${DEPLOY_USER}@${DEPLOY_HOST}"
ssh "${DEPLOY_USER}@${DEPLOY_HOST}" "cd ${DEPLOY_PATH} && docker compose logs -f --tail=200 ${SERVICE_NAME}"
