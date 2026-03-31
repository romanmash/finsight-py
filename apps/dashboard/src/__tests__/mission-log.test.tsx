import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { MissionLog } from '../dashboard/MissionLog';

describe('mission log', () => {
  it('shows empty state when no recent completed/failed missions', (): void => {
    const html = renderToStaticMarkup(<MissionLog missions={[]} />);
    expect(html).toContain('No recent missions');
  });

  it('shows completed missions using status=complete', (): void => {
    const html = renderToStaticMarkup(
      <MissionLog
        missions={[
          {
            id: 'm1',
            type: 'operator_query',
            status: 'complete',
            tickers: ['NVDA'],
            createdAt: new Date().toISOString(),
            completedAt: new Date().toISOString()
          }
        ]}
      />
    );

    expect(html).not.toContain('No recent missions');
    expect(html).toContain('operator_query');
  });

  it('hides running missions from the log', (): void => {
    const html = renderToStaticMarkup(
      <MissionLog
        missions={[
          {
            id: 'm1',
            type: 'operator_query',
            status: 'running',
            tickers: ['NVDA'],
            createdAt: new Date().toISOString(),
            completedAt: null
          }
        ]}
      />
    );

    expect(html).toContain('No recent missions');
  });
});
