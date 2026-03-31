import type { MissionActive } from '../status/status-types';

interface MissionPipelineProps {
  mission: MissionActive | null;
}

export function MissionPipeline({ mission }: MissionPipelineProps): JSX.Element {
  if (mission === null) {
    return (
      <section className="panel">
        <h2>Mission Pipeline</h2>
        <p>No active mission</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h2>Mission Pipeline</h2>
      <p>
        {mission.type} | {mission.tickers.join(', ')} | Trigger: {mission.trigger}
      </p>
      {mission.pipeline === undefined || mission.pipeline.length === 0 ? (
        <p className="pipeline-unavailable">Pipeline step detail not available</p>
      ) : (
        <ol className="pipeline-list">
          {mission.pipeline.map((step) => (
            <li key={step.agent} className={`pipeline-step ${step.status}`}>
              <span className="pipeline-node" />
              <div>
                <strong>{step.agent}</strong>
                {step.tools !== undefined && step.status === 'running' ? (
                  <ul className="tool-list">
                    {step.tools.map((tool) => (
                      <li key={`${step.agent}-${tool.name}`}>
                        <span className={`tool-dot ${tool.status}`} />
                        {tool.name}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
