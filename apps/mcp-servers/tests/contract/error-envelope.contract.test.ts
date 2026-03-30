import { describe, expect, it } from 'vitest';

import { createSampleServer } from '../../src/shared/__fixtures__/sample-server.js';
import { invokeTool } from '../helpers/test-app.js';

describe('error envelope contract', () => {
  it('returns deterministic error object with code/message', async () => {
    const app = createSampleServer();

    const result = await invokeTool<{ error: { code: string; message: string }; durationMs: number }>(app, {
      tool: 'echo',
      input: { wrong: 'shape' }
    });

    expect(result.status).toBe(400);
    expect(result.body.error.code).toBe('VALIDATION_ERROR');
    expect(typeof result.body.error.message).toBe('string');
    expect(typeof result.body.durationMs).toBe('number');
  });
});

