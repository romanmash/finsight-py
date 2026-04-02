# 011 Seed & Infrastructure - Preserved Decisions

## Purpose

This document preserves implementation-significant details from the original manual draft so they are not lost during canonical specification normalization.

## Preserved Decision Set

1. Demo-first seed objective is mandatory
- Seed must produce a "lived-in" environment, not only minimal valid records.
- Demo walkthrough should include visible history, contradictions, pending alerts, prior missions, and populated dashboard surfaces.

2. Representative seeded data domains to include
- User/account context for admin and analyst personas.
- Portfolio/watchlist context with multiple tickers.
- Knowledge base current thesis and historical snapshots including a contradiction transition.
- Screener run history with non-empty findings.
- Alert history containing at least one upcoming high-severity event.
- Prior mission records with associated run-level traceability.
- Ingested-document baseline for RAG/search demonstration.

3. Idempotency and rerun safety are non-negotiable
- Seed command must be rerunnable without duplicate logical entities.
- Reconciliation strategy (upsert/merge) should be selected in planning and verified in tests.

4. Credentials/secrets handling constraints
- Original manual draft included explicit demo credential values.
- Canonical project rule applies: no hardcoded secrets in source.
- Final implementation should use environment/config-driven credentials for seeded accounts.
- If a demo default is needed, it must be non-secret, explicitly documented, and overrideable.

5. Delivery automation policy
- Pull requests to integration branch run full validation gates.
- Deploy-capable job runs only for allowed release branch events.
- Gate failures must block deployment.

6. Operational scripts expectations
- Deploy script performs synchronization plus remote service restart/update.
- Logs helper supports targeted service log streaming for operator troubleshooting.
- Post-deploy health verification is required, not optional.

7. Infrastructure-as-code scope intent
- Cloud resource planning/provisioning intent must be represented in IaC with previewability.
- Local/server deployment remains valid; cloud provisioning is an additional deployment path.

## Planning Handoff Notes

- `/speckit-plan` must map each preserved decision into explicit technical decisions, contracts, and taskable outputs.
- Any deviation from this preserved set requires rationale in planning artifacts.

## Original Manual Detail Inventory (Explicit Retention)

These concrete details are intentionally preserved from the original draft for planning reconciliation:

- Seed should include at least two user personas (admin + analyst) with demo-login viability.
- Portfolio/watchlist examples from original draft:
  - Portfolio-style holdings example: NVDA 50, AAPL 100, GLD 20.
  - Watchlist examples: `portfolio` (NVDA, AAPL, GLD) and `interesting` (SPY, AMD, MSFT).
- Knowledge seed example centered on NVDA thesis continuity with historical transitions.
- Historical snapshot pattern from original draft: 4 snapshots spanning ~10 days and including at least one contradiction event.
- Alerting example from original draft: one upcoming earnings-related high-severity alert.
- Mission history examples from original draft: at least two prior missions with run-level records.
- Ingested document baseline from original draft: at least three document/chunk entries suitable for retrieval demo.
- CI/CD branch policy examples from original draft:
  - PR/integration branch executes quality-only gates.
  - Main/release branch executes deploy-capable pipeline.
- Deploy script behavior examples from original draft:
  - Sync runtime artifacts to remote target.
  - Restart/update service stack remotely.
  - Validate health after deployment.
- Logs helper behavior example from original draft:
  - Tail logs for named service/container target.

Note: Exact implementation shape remains a planning concern, but these values/examples are authoritative references from the original manual spec and should not be dropped silently.
