import type { MissionRecent } from '../status/status-types';
import { formatTimestamp } from './formatters';

interface MissionLogProps {
  missions: MissionRecent[];
}

export function MissionLog({ missions }: MissionLogProps): JSX.Element {
  const visible = missions.filter((mission) => mission.status === 'complete' || mission.status === 'failed').slice(0, 10);

  return (
    <section className="panel">
      <h2>Mission Log</h2>
      {visible.length === 0 ? <p>No recent missions</p> : null}
      <ul className="mission-log-list">
        {visible.map((mission) => (
          <li key={mission.id}>
            <p>
              <strong>{mission.type}</strong> ({mission.status})
            </p>
            <p>{formatTimestamp(mission.completedAt ?? mission.createdAt)}</p>
            {mission.traceUrl !== undefined ? (
              <a href={mission.traceUrl} target="_blank" rel="noreferrer">
                LangSmith trace
              </a>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
