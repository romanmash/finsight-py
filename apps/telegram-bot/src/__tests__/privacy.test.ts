import { describe, expect, it } from 'vitest';

import { loadBotEnv } from '../config.js';

describe('privacy guardrails', () => {
  it('does not expose token values through structured env API', () => {
    process.env.TELEGRAM_BOT_TOKEN = 'token-value';
    process.env.TELEGRAM_INTERNAL_TOKEN = 'internal-token';
    process.env.TELEGRAM_API_ACCESS_TOKEN = 'api-access-token';

    const env = loadBotEnv();
    expect(env.telegramBotToken).toBe('token-value');
    expect(Object.keys(env)).not.toContain('password');
  });
});
