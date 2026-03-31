import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AgentFloor } from '../dashboard/AgentFloor';

describe('agent floor', () => {
  it('renders 9 agent slots', () => {
    const html = renderToStaticMarkup(
      <AgentFloor
        agents={{
          manager: { state: 'idle', currentTask: null, currentMissionId: null, model: null, provider: null, todayTokensIn: 0, todayTokensOut: 0, todayCostUsd: 0, lastActiveAt: null, errorMessage: null },
          watchdog: { state: 'idle', currentTask: null, currentMissionId: null, model: null, provider: null, todayTokensIn: 0, todayTokensOut: 0, todayCostUsd: 0, lastActiveAt: null, errorMessage: null },
          screener: { state: 'idle', currentTask: null, currentMissionId: null, model: null, provider: null, todayTokensIn: 0, todayTokensOut: 0, todayCostUsd: 0, lastActiveAt: null, errorMessage: null },
          researcher: { state: 'idle', currentTask: null, currentMissionId: null, model: null, provider: null, todayTokensIn: 0, todayTokensOut: 0, todayCostUsd: 0, lastActiveAt: null, errorMessage: null },
          analyst: { state: 'idle', currentTask: null, currentMissionId: null, model: null, provider: null, todayTokensIn: 0, todayTokensOut: 0, todayCostUsd: 0, lastActiveAt: null, errorMessage: null },
          technician: { state: 'idle', currentTask: null, currentMissionId: null, model: null, provider: null, todayTokensIn: 0, todayTokensOut: 0, todayCostUsd: 0, lastActiveAt: null, errorMessage: null },
          bookkeeper: { state: 'idle', currentTask: null, currentMissionId: null, model: null, provider: null, todayTokensIn: 0, todayTokensOut: 0, todayCostUsd: 0, lastActiveAt: null, errorMessage: null },
          reporter: { state: 'idle', currentTask: null, currentMissionId: null, model: null, provider: null, todayTokensIn: 0, todayTokensOut: 0, todayCostUsd: 0, lastActiveAt: null, errorMessage: null },
          trader: { state: 'idle', currentTask: null, currentMissionId: null, model: null, provider: null, todayTokensIn: 0, todayTokensOut: 0, todayCostUsd: 0, lastActiveAt: null, errorMessage: null }
        }}
      />
    );

    expect(html.match(/agent-card/g)?.length ?? 0).toBe(9);
  });
});
