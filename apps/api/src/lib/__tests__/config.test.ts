import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface ConfigModule {
  getConfig: () => unknown;
  initConfig: () => Promise<void>;
  reloadConfig: () => Promise<{ changed: string[] }>;
}

function createFixtureRuntimeDir(): string {
  const tempRoot = mkdtempSync(join(tmpdir(), 'finsight-config-'));
  const source = resolve(process.cwd(), 'src/lib/__tests__/__fixtures__/runtime');
  const target = join(tempRoot, 'runtime');
  cpSync(source, target, { recursive: true });
  return target;
}

async function loadConfigModule(): Promise<ConfigModule> {
  vi.resetModules();
  return import('../config.js') as Promise<ConfigModule>;
}

describe('config loader', () => {
  let configDir = '';
  let exitSpy: { mockRestore: () => void } | null = null;

  beforeEach(() => {
    configDir = createFixtureRuntimeDir();
    process.env.CONFIG_DIR = configDir;
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: string | number | null) => {
      throw new Error(`process.exit:${String(code)}`);
    }) as never);
  });

  afterEach(() => {
    delete process.env.CONFIG_DIR;
    if (exitSpy !== null) {
      exitSpy.mockRestore();
    }

    if (configDir.length > 0) {
      rmSync(resolve(configDir, '..'), { recursive: true, force: true });
    }
  });

  it('loads and validates all 11 YAML files successfully', async () => {
    const config = await loadConfigModule();

    await config.initConfig();
    const loaded = config.getConfig() as { agents: { manager: { primary: { provider: string } } } };

    expect(loaded.agents.manager.primary.provider).toBe('anthropic');
  });

  it('exits with code 1 when manager.primary.provider is missing', async () => {
    const broken = readFileSync(join(configDir, 'agents.yaml'), 'utf8').replace('provider: anthropic, ', '');
    writeFileSync(join(configDir, 'agents.yaml'), broken);

    const config = await loadConfigModule();
    await expect(config.initConfig()).rejects.toThrow('process.exit:1');
  });

  it('exits with code 1 when temperature has wrong type', async () => {
    const broken = readFileSync(join(configDir, 'agents.yaml'), 'utf8').replace('temperature: 0.2', 'temperature: "hot"');
    writeFileSync(join(configDir, 'agents.yaml'), broken);

    const config = await loadConfigModule();
    await expect(config.initConfig()).rejects.toThrow('process.exit:1');
  });

  it('returns cached config synchronously after init', async () => {
    const config = await loadConfigModule();
    await config.initConfig();

    const first = config.getConfig();
    const second = config.getConfig();

    expect(first).toBe(second);
  });

  it('throws if getConfig called before initConfig', async () => {
    const config = await loadConfigModule();

    expect(() => config.getConfig()).toThrow('Configuration has not been initialized');
  });

  it('reloadConfig returns changed keys when file changes', async () => {
    const config = await loadConfigModule();
    await config.initConfig();

    const updated = readFileSync(join(configDir, 'watchdog.yaml'), 'utf8').replace('newsLookbackMinutes: 30', 'newsLookbackMinutes: 45');
    writeFileSync(join(configDir, 'watchdog.yaml'), updated);

    const result = await config.reloadConfig();
    expect(result.changed).toContain('watchdog');
  });

  it('reloadConfig preserves existing config when update is invalid', async () => {
    const config = await loadConfigModule();
    await config.initConfig();

    const before = config.getConfig() as { watchdog: { newsLookbackMinutes: number } };
    const broken = readFileSync(join(configDir, 'watchdog.yaml'), 'utf8').replace('newsLookbackMinutes: 30', 'newsLookbackMinutes: "oops"');
    writeFileSync(join(configDir, 'watchdog.yaml'), broken);

    await expect(config.reloadConfig()).rejects.toThrow();

    const after = config.getConfig() as { watchdog: { newsLookbackMinutes: number } };
    expect(after.watchdog.newsLookbackMinutes).toBe(before.watchdog.newsLookbackMinutes);
  });
});
