# Data Model: Seed & Infrastructure (011)

## Seed Data Constants

**Location**: `apps/api-service/src/api/seeds/constants.py`

Fixed UUIDs for all demo entities:

| Constant | Value (fixed UUID) | Entity |
|----------|-------------------|--------|
| ADMIN_OPERATOR_ID | "00000000-0000-0000-0000-000000000001" | Admin operator |
| VIEWER_OPERATOR_ID | "00000000-0000-0000-0000-000000000002" | Viewer operator |
| MISSION_COMPLETED_ID | "00000000-0000-0000-0000-000000000010" | Completed investigation |
| MISSION_FAILED_ID | "00000000-0000-0000-0000-000000000011" | Failed investigation |
| MISSION_ACTIVE_ID | "00000000-0000-0000-0000-000000000012" | Active investigation |
| WATCHLIST_SPY_ID | "00000000-0000-0000-0000-000000000020" | SPY watchlist item |
| WATCHLIST_AAPL_ID | "00000000-0000-0000-0000-000000000021" | etc. |

---

## Seed Data Sets

### Operators (2)

| Field | Admin | Viewer |
|-------|-------|--------|
| id | ADMIN_OPERATOR_ID | VIEWER_OPERATOR_ID |
| username | "admin" | "viewer" |
| role | "admin" | "viewer" |
| password | bcrypt("demo_admin_pass") | bcrypt("demo_viewer_pass") |
| telegram_user_id | None | None |

### WatchlistItems (5)

Tickers: SPY, AAPL, NVDA, GLD, BTC-USD
Each with: `price_change_pct_threshold=3.0`, `volume_spike_multiplier=2.0`, `is_active=True`

### Missions (3)

- MISSION_COMPLETED_ID: `query="Why is SPY moving today?"`, `status=COMPLETED`
- MISSION_FAILED_ID: `query="Analyse NVDA earnings"`, `status=FAILED`
- MISSION_ACTIVE_ID: `query="Gold thesis update"`, `status=RUNNING`

### Alerts (3)

- 1 acknowledged: SPY price move > 3%, `severity=MEDIUM`, `acknowledged_at=<timestamp>`
- 2 unacknowledged: AAPL volume spike + GLD price move

---

## Pulumi Resource Model

**Location**: `infra/pulumi/__main__.py`

| Resource | Type | Description |
|----------|------|-------------|
| server | hcloud.Server | CX21 (2 vCPU, 4GB RAM) Ubuntu 24.04 |
| firewall | hcloud.Firewall | Allow 22, 80, 443; deny all else |
| ssh_key | hcloud.SshKey | Developer public key |
| volume | hcloud.Volume | 20GB attached volume for Postgres data |

---

## Deploy Script Variables (from .env)

| Variable | Description |
|----------|-------------|
| SERVER_HOST | Linux server IP or hostname |
| SERVER_USER | SSH username (default: "deploy") |
| SERVER_PATH | Remote path for source files (default: "~/finsight") |
| SERVER_SSH_KEY | Path to SSH private key (default: "~/.ssh/id_ed25519") |
