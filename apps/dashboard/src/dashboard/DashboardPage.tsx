import { useMemo } from 'react';

import { useAuth } from '../auth/AuthProvider';
import { StatusClient } from '../status/status-client';
import { useAdminStatus } from '../status/useAdminStatus';
import { AgentFloor } from './AgentFloor';
import { AdminActions } from './AdminActions';
import { HealthPanel } from './HealthPanel';
import { MissionLog } from './MissionLog';
import { MissionPipeline } from './MissionPipeline';
import { SpendPanel } from './SpendPanel';
import { formatTimestamp } from './formatters';

export function DashboardPage(): JSX.Element {
  const auth = useAuth();

  const client = useMemo<StatusClient>(
    () =>
      new StatusClient({
        getAccessToken: (): string | null => auth.session?.accessToken ?? null,
        onUnauthorized: auth.logout
      }),
    [auth.logout, auth.session?.accessToken]
  );

  const status = useAdminStatus({ client });

  if (status.isLoading && status.snapshot === null) {
    return <main className="loading">Loading Mission Control...</main>;
  }

  if (status.snapshot === null) {
    return (
      <main className="loading">
        <p>Unable to load dashboard status.</p>
        <p>{status.error ?? 'Unknown error'}</p>
      </main>
    );
  }

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <h1>Mission Control</h1>
        <p>Last update: {formatTimestamp(status.lastSuccessAt)}</p>
        {status.isDegradedConnection ? (
          <p className="degraded-banner">Warning: connection degraded, showing last known snapshot.</p>
        ) : null}
      </header>

      <AgentFloor agents={status.snapshot.agents} />
      <MissionPipeline mission={status.snapshot.mission.active} />
      <HealthPanel health={status.snapshot.health} />
      <SpendPanel totalUsd={status.snapshot.spend.todayTotalUsd} byProvider={status.snapshot.spend.byProvider} />
      <MissionLog missions={status.snapshot.mission.recent} />

      <section className="panel">
        <h2>Queues / KB</h2>
        <p>Pending Alerts: {status.snapshot.queues.pendingAlerts}</p>
        <p>Pending Tickets: {status.snapshot.queues.pendingTickets}</p>
        <p>KB Entries: {status.snapshot.kb.totalEntries}</p>
        <p>Contradictions: {status.snapshot.kb.contradictionCount}</p>
      </section>

      <AdminActions client={client} />
    </main>
  );
}
