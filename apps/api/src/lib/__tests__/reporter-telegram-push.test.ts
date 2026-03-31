import { beforeEach, describe, expect, it, vi } from 'vitest';

const dispatchTelegramInternalPush = vi.fn();

vi.mock('../telegram-internal.js', () => ({ dispatchTelegramInternalPush }));

describe('reporter telegram push integration', () => {
  beforeEach(() => {
    dispatchTelegramInternalPush.mockReset();
    dispatchTelegramInternalPush.mockResolvedValue({ delivered: true, reason: 'sent' });
  });

  it('dispatches internal telegram pushes by default', async () => {
    const { runReporter } = await import('../../agents/reporter.js');
    const { buildReporterInput } = await import('./mocks/reasoning.js');

    const output = await runReporter(buildReporterInput(), {
      formatPrimary: async () => 'formatted',
      formatFallback: async () => 'fallback',
      persistDailyBrief: async () => null,
      sendTelegram: async (userId, message) => {
        await dispatchTelegramInternalPush({ userId, message, sourceType: 'system' });
      }
    });

    expect(output.delivered).toBe(true);
    expect(dispatchTelegramInternalPush).toHaveBeenCalled();
  });
});
