import { describe, expect, it } from 'vitest';

import { runReporter } from '../../agents/reporter.js';
import { buildReporterInput } from './mocks/reasoning.js';

describe('runReporter', () => {
  it('formats and sends mission output', async () => {
    const messages: string[] = [];
    const output = await runReporter(buildReporterInput(), {
      formatPrimary: async () => 'formatted',
      formatFallback: async () => 'fallback',
      sendTelegram: async (_userId, message) => {
        messages.push(message);
      },
      persistDailyBrief: async () => null
    });

    expect(output.delivered).toBe(true);
    expect(messages.length).toBe(1);
    expect(output.label.length).toBeGreaterThan(0);
  });

  it('uses fallback formatter when primary fails', async () => {
    const output = await runReporter(buildReporterInput(), {
      formatPrimary: async () => {
        throw new Error('primary down');
      },
      formatFallback: async () => 'fallback text',
      sendTelegram: async () => {},
      persistDailyBrief: async () => null
    });

    expect(output.delivered).toBe(true);
  });

  it('chunks oversized messages', async () => {
    const messages: string[] = [];
    const output = await runReporter(buildReporterInput(), {
      formatPrimary: async () => 'x'.repeat(9000),
      formatFallback: async () => 'fallback',
      sendTelegram: async (_userId, message) => {
        messages.push(message);
      },
      persistDailyBrief: async () => null
    });

    expect(output.messageCount).toBeGreaterThan(1);
    expect(messages.join('').includes('x')).toBe(true);
  });

  it('persists daily brief when mission type is daily_brief', async () => {
    const output = await runReporter(buildReporterInput({ missionType: 'daily_brief' }), {
      formatPrimary: async () => 'brief text',
      formatFallback: async () => 'fallback',
      sendTelegram: async () => {},
      persistDailyBrief: async () => 'brief-1'
    });

    expect(output.persistedDailyBriefId).toBe('brief-1');
  });
});
