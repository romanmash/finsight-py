import { describe, expect, it } from 'vitest';

import { runTrader } from '../../agents/trader.js';
import { buildTraderInput } from './mocks/reasoning.js';

describe('runTrader', () => {
  it('creates pending approval ticket', async () => {
    const output = await runTrader(buildTraderInput(), {
      getCurrentThesis: async () => ({ content: 'thesis' }),
      getQuantity: async () => 10,
      buildRationale: async () => 'One. Two. Three.',
      createTicket: async () => 'ticket-1'
    });

    expect(output.status).toBe('pending_approval');
    expect(output.ticketId).toBe('ticket-1');
  });

  it('requires exactly three sentence rationale', async () => {
    await expect(
      runTrader(buildTraderInput(), {
        getCurrentThesis: async () => ({ content: 'thesis' }),
        getQuantity: async () => 10,
        buildRationale: async () => 'One. Two.',
        createTicket: async () => 'ticket-1'
      })
    ).rejects.toThrow(/exactly three sentences/);
  });

  it('includes human approval warning text', async () => {
    const output = await runTrader(buildTraderInput(), {
      getCurrentThesis: async () => ({ content: 'thesis' }),
      getQuantity: async () => 10,
      buildRationale: async () => 'One. Two. Three.',
      createTicket: async () => 'ticket-2'
    });

    expect(output.warningText).toContain('requires explicit human approval');
  });

  it('rejects sell for non-held position', async () => {
    await expect(
      runTrader(buildTraderInput({ action: 'sell' }), {
        getCurrentThesis: async () => ({ content: 'thesis' }),
        getQuantity: async () => 0,
        buildRationale: async () => 'One. Two. Three.',
        createTicket: async () => 'ticket-3'
      })
    ).rejects.toThrow(/non-held position/);
  });
});
