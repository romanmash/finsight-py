import { describe, expect, it } from 'vitest';

import { parseEnvelope, validateParsedCommand } from '../commands.js';

describe('commands contract', () => {
  it('supports all preserved commands', () => {
    const samples = [
      '/help',
      '/brief',
      '/pattern AAPL 2w',
      '/compare AAPL MSFT',
      '/devil TSLA',
      '/thesis NVDA',
      '/history NVDA',
      '/screener show last',
      '/trade AAPL buy 10',
      '/approve ticket-1',
      '/reject ticket-1 reason text',
      '/alert',
      '/ack alert-1',
      '/watchlist',
      '/add AAPL interesting',
      '/portfolio'
    ];

    for (const sample of samples) {
      const parsed = parseEnvelope(sample);
      expect(parsed.parsedCommand).not.toBeNull();
      expect(validateParsedCommand(parsed.parsedCommand!)).toBeNull();
    }
  });

  it('requires exact screener phrase', () => {
    const parsed = parseEnvelope('/screener latest');
    expect(parsed.parsedCommand).toBeNull();
  });

  it('rejects invalid argument shapes', () => {
    const cases: string[] = [
      '/pattern AAPL',
      '/compare AAPL',
      '/devil',
      '/thesis',
      '/history',
      '/trade AAPL buy -1',
      '/trade AAPL sideways 10',
      '/approve',
      '/reject',
      '/ack',
      '/add AAPL'
    ];

    for (const input of cases) {
      const parsed = parseEnvelope(input);
      if (parsed.parsedCommand === null) {
        continue;
      }

      expect(validateParsedCommand(parsed.parsedCommand)).not.toBeNull();
    }
  });
});
