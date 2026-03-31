import type { AdminStatusSnapshot } from '../status/status-types';
import { formatUsd } from './formatters';

interface AgentFloorProps {
  agents: AdminStatusSnapshot['agents'];
}

const DISPLAY_ORDER = ['manager', 'watchdog', 'screener', 'researcher', 'analyst', 'technician', 'bookkeeper', 'reporter', 'trader'];

export function AgentFloor({ agents }: AgentFloorProps): JSX.Element {
  return (
    <section className="panel agent-floor">
      <h2>Agent Floor</h2>
      <div className="agent-grid">
        {DISPLAY_ORDER.map((name) => {
          const entry = agents[name];
          const stateClass = entry?.state ?? 'error';
          return (
            <article key={name} className={`agent-card state-${stateClass}`}>
              <div className="agent-left">{name}</div>
              <div className="agent-main">
                <p className="agent-task">{entry?.currentTask ?? 'Idle'}</p>
                <p className="agent-model">
                  {(entry?.provider ?? '-').toUpperCase()} / {(entry?.model ?? '-').toLowerCase()}
                </p>
              </div>
              <div className="agent-right">
                <span className={`state-pill ${stateClass}`}>{stateClass}</span>
                <strong>{formatUsd(entry?.todayCostUsd ?? 0)}</strong>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
