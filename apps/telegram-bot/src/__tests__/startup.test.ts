import { describe, expect, it } from 'vitest';

import { loadBotEnv, loadTelegramRuntimeConfig } from '../config.js';

describe('startup checks', () => {
  it('fails when required env is missing', () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    process.env.TELEGRAM_INTERNAL_TOKEN = 'x';
    process.env.TELEGRAM_API_ACCESS_TOKEN = 'api';
    expect(() => loadBotEnv()).toThrow('TELEGRAM_BOT_TOKEN is required');
  });

  it('fails when TELEGRAM_API_ACCESS_TOKEN is missing', () => {
    process.env.TELEGRAM_BOT_TOKEN = 'tok';
    process.env.TELEGRAM_INTERNAL_TOKEN = 'int';
    delete process.env.TELEGRAM_API_ACCESS_TOKEN;

    expect(() => loadBotEnv()).toThrow('TELEGRAM_API_ACCESS_TOKEN is required');
  });

  it('loads telegram runtime config from configured directory', async () => {
    process.env.CONFIG_DIR = process.cwd() + '/../../config/runtime';
    await expect(loadTelegramRuntimeConfig()).resolves.toBeDefined();
  });
});
