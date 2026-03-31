import type { AdminStatusSnapshot } from '../status/status-types';

interface HealthPanelProps {
  health: AdminStatusSnapshot['health'];
}

export function HealthPanel({ health }: HealthPanelProps): JSX.Element {
  const mcpEntries = Object.entries(health.mcpServers);
  const slots: Array<{ name: string; status: string }> = [
    { name: 'postgres', status: health.postgres.status },
    { name: 'redis', status: health.redis.status },
    ...mcpEntries.map(([name, entry]) => ({ name, status: entry.status })),
    { name: 'lmStudio', status: health.lmStudio.status },
    { name: 'telegramBot', status: health.telegramBot.status }
  ];

  return (
    <section className="panel">
      <h2>Health</h2>
      <ul className="health-list">
        {slots.map((slot) => (
          <li key={slot.name}>
            <span className={`health-dot ${slot.status}`} />
            {slot.name}
          </li>
        ))}
      </ul>
    </section>
  );
}
