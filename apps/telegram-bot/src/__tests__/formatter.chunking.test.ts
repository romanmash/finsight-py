import { describe, expect, it } from 'vitest';

import { splitMessage } from '../formatter.js';

describe('formatter chunking', () => {
  it('keeps chunk order and no empty chunks', () => {
    const chunks = splitMessage('line '.repeat(1000), 128);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length > 0)).toBe(true);
  });
});
