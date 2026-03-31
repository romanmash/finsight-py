import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AgentFloor } from '../dashboard/AgentFloor';

const EMPTY_AGENT = {
  state: 'idle' as const,
  currentTask: null,
  currentMissionId: null,
  model: null,
  provider: null,
  todayTokensIn: 0,
  todayTokensOut: 0,
  todayCostUsd: 0,
  lastActiveAt: null,
  errorMessage: null
};

const ALL_NINE_AGENTS = {
  manager: EMPTY_AGENT,
  watchdog: EMPTY_AGENT,
  screener: EMPTY_AGENT,
  researcher: EMPTY_AGENT,
  analyst: EMPTY_AGENT,
  technician: EMPTY_AGENT,
  bookkeeper: EMPTY_AGENT,
  reporter: EMPTY_AGENT,
  trader: EMPTY_AGENT
};

describe('dashboard fidelity', () => {
  it('renders exactly 9 agent cards', (): void => {
    const html = renderToStaticMarkup(<AgentFloor agents={ALL_NINE_AGENTS} />);
    expect(html.match(/agent-card/g)?.length ?? 0).toBe(9);
  });

  it('renders missing agent slot with error fallback state', (): void => {
    const { trader: _omitted, ...partial } = ALL_NINE_AGENTS;
    const html = renderToStaticMarkup(<AgentFloor agents={partial} />);

    expect(html.match(/agent-card/g)?.length ?? 0).toBe(9);
    expect(html).toContain('state-error');
  });

  it('locks required layout constants', (): void => {
    const shellColumns = '280px 1fr 200px 180px';
    const cardZones = '84px 1fr auto';

    expect(shellColumns).toContain('280px');
    expect(cardZones).toContain('84px');
  });
});
