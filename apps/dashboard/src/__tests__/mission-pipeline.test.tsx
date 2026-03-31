import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { MissionPipeline } from '../dashboard/MissionPipeline';

describe('mission pipeline', () => {
  it('shows no active mission state', (): void => {
    const html = renderToStaticMarkup(<MissionPipeline mission={null} />);
    expect(html).toContain('No active mission');
  });

  it('shows unavailable message when pipeline detail is absent', (): void => {
    const html = renderToStaticMarkup(
      <MissionPipeline
        mission={{
          id: 'm1',
          type: 'operator_query',
          status: 'running',
          tickers: ['NVDA'],
          trigger: 'user',
          createdAt: new Date().toISOString()
        }}
      />
    );

    expect(html).toContain('Pipeline step detail not available');
    expect(html).not.toContain('pipeline-step running');
  });

  it('renders backend-provided pipeline steps', (): void => {
    const html = renderToStaticMarkup(
      <MissionPipeline
        mission={{
          id: 'm1',
          type: 'operator_query',
          status: 'running',
          tickers: ['NVDA'],
          trigger: 'user',
          createdAt: new Date().toISOString(),
          pipeline: [
            { agent: 'researcher', status: 'running' },
            { agent: 'analyst', status: 'pending' }
          ]
        }}
      />
    );

    expect(html).toContain('researcher');
    expect(html).toContain('pipeline-step running');
    expect(html).not.toContain('Pipeline step detail not available');
  });
});
