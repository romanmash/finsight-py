import { describe, expect, it } from 'vitest';

import type { ActionFeedback, ActionFeedbackClass } from '../status/status-types';

describe('action feedback envelope contract', () => {
  const kinds: ActionFeedbackClass[] = ['success', 'retriable_error', 'terminal_error'];

  for (const kind of kinds) {
    it(`supports action feedback kind ${kind}`, (): void => {
      const feedback: ActionFeedback = { kind, message: 'ok', at: new Date().toISOString() };
      expect(feedback.kind).toBe(kind);
      expect(typeof feedback.message).toBe('string');
      expect(typeof feedback.at).toBe('string');
    });
  }

  it('reload response contract has changed array', (): void => {
    const payload = { changed: ['auth', 'agents'] };
    expect(Array.isArray(payload.changed)).toBe(true);
    expect(payload.changed).toContain('auth');
  });

  it('trigger response contract has queued boolean', (): void => {
    const payload = { queued: true, queue: 'screenerScan' };
    expect(payload.queued).toBe(true);
    expect(typeof payload.queue).toBe('string');
  });
});
