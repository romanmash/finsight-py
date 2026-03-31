I'm a private developer applying for the freelance position (see POSITION.md).
I have a local setup at home-office (see SETUP.md).

Define a potential case (create CASE.md or PRD.md) that I can implement and make a demo/pitch to the customer, to prove that I match the position.
This PoC should cover all described frameworks, if possible.
Btw, I can develop everything on my windows PC and deploy it to the server from PC, so it can run there.

Lets brainstorm, and prepare a few proposals !

---

## 006 Collector Agents Runbook

### Manual Trigger Endpoints (Admin)

- `POST /api/watchdog/trigger`
- `POST /api/screener/trigger`

Both endpoints enqueue jobs with `triggeredBy: manual` and require admin auth middleware.

### Operational State Keys

Collector state is written to Redis under:

- `agent:state:watchdog`
- `agent:state:screener`
- `agent:state:researcher`
- `agent:state:technician`

State transitions follow `active -> idle` on success or `active -> error` on failure.
TTL is controlled via runtime config: `app.collector.stateTtlSeconds`.

### Scheduler Jobs

Registered periodic jobs:

- `watchdogScan`
- `screenerScan`
- `dailyBrief`
- `earningsCheck`
- `ticketExpiry`

All cadence/retry parameters are runtime-configured from `config/runtime/scheduler.yaml`.

### Runtime Config Controls

- `config/runtime/watchdog.yaml`
  - `priceAlertThresholdPct`
  - `volumeSpikeMultiplier`
  - `earningsPreBriefDaysAhead`
  - `newsLookbackMinutes`
- `config/runtime/screener.yaml`
  - `sectors`
  - `minimumSignalScore`
  - `topResultsPerRun`
- `config/runtime/app.yaml`
  - `collector.stateTtlSeconds`
  - `collector.researcherMaxToolSteps`

### Ticket Expiry Worker

- Periodic 	icketExpiry jobs now transition TradeTicket records from pending_approval to expired when expiresAt <= now.
- Expired tickets are stamped with ejectionReason: expired_by_scheduler for auditability.

### Validation Commands

- `pnpm --filter @finsight/api typecheck`
- `pnpm --filter @finsight/api lint`
- `pnpm --filter @finsight/api test`

If test execution fails in restricted environments with process-spawn errors (`EPERM`), run tests in a normal local shell outside sandbox restrictions.
