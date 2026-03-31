import { describe, expect, it } from 'vitest';

import { runBookkeeper } from '../../agents/bookkeeper.js';
import { buildBookkeeperInput, contradictionForText } from './mocks/reasoning.js';

describe('runBookkeeper', () => {
  it('creates initial change type when no prior thesis', async () => {
    const input = buildBookkeeperInput();
    const output = await runBookkeeper(input, {
      getPriorThesis: async () => null,
      assessContradiction: async () => 'none',
      generateEmbedding: async () => Array.from({ length: 1536 }, () => 1),
      persist: async () => ({ kbEntryId: 'kb-1', snapshotCreated: false })
    });

    expect(output.changeType).toBe('initial');
    expect(output.snapshotCreated).toBe(false);
  });

  it('creates snapshot on non-initial updates', async () => {
    const input = buildBookkeeperInput();
    const output = await runBookkeeper(input, {
      getPriorThesis: async () => ({ kbEntryId: 'old', content: 'prior', confidence: 'medium' }),
      assessContradiction: async () => 'none',
      generateEmbedding: async () => Array.from({ length: 1536 }, () => 1),
      persist: async () => ({ kbEntryId: 'kb-2', snapshotCreated: true })
    });

    expect(output.changeType).toBe('update');
    expect(output.snapshotCreated).toBe(true);
  });

  it('flags contradiction change type for high severity', async () => {
    const input = buildBookkeeperInput({ analystOutput: { ...(buildBookkeeperInput().analystOutput), thesisUpdate: 'contradiction' } });
    const output = await runBookkeeper(input, {
      getPriorThesis: async () => ({ kbEntryId: 'old', content: 'prior thesis', confidence: 'medium' }),
      assessContradiction: async (_prior, next) => contradictionForText(next.thesisUpdate),
      generateEmbedding: async () => Array.from({ length: 1536 }, () => 1),
      persist: async () => ({ kbEntryId: 'kb-3', snapshotCreated: true })
    });

    expect(output.changeType).toBe('contradiction');
    expect(output.contradictionSeverity).toBe('high');
  });

  it('throws when embedding length is invalid', async () => {
    const input = buildBookkeeperInput();

    await expect(
      runBookkeeper(input, {
        getPriorThesis: async () => null,
        assessContradiction: async () => 'none',
        generateEmbedding: async () => [1, 2, 3],
        persist: async () => ({ kbEntryId: 'kb-4', snapshotCreated: false })
      })
    ).rejects.toThrow(/embedding length/);
  });
});
