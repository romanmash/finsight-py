import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { HealthPanel } from '../dashboard/HealthPanel';

describe('health panel', () => {
  it('renders core services', () => {
    const html = renderToStaticMarkup(
      <HealthPanel
        health={{
          postgres: { status: 'ok', message: null, checkedAt: new Date().toISOString() },
          redis: { status: 'ok', message: null, checkedAt: new Date().toISOString() },
          mcpServers: {},
          lmStudio: { status: 'degraded', message: 'timeout', checkedAt: new Date().toISOString() },
          telegramBot: { status: 'ok', message: null, checkedAt: new Date().toISOString() }
        }}
      />
    );

    expect(html).toContain('postgres');
    expect(html).toContain('telegramBot');
  });
});
