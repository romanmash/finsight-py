import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMock = {
  mission: {
    create: vi.fn(),
    update: vi.fn()
  },
  agentRun: {
    create: vi.fn()
  },
  kbEntry: {
    findFirst: vi.fn(),
    create: vi.fn()
  },
  kbThesisSnapshot: {
    create: vi.fn()
  },
  tradeTicket: {
    create: vi.fn()
  }
};

const runResearcherMock = vi.fn(async (): Promise<object> => ({
  ticker: 'NVDA',
  focusQuestions: ['q'],
  missionType: 'operator_query',
  collectedFacts: [],
  newsSummary: {},
  fundamentalsSummary: {},
  kbContext: [],
  confidence: 'high',
  gaps: [],
  _usage: {
    tokensIn: 120,
    tokensOut: 80,
    costUsd: 0.001
  }
}));

const runTechnicianMock = vi.fn(async (): Promise<object> => ({
  ticker: 'NVDA',
  periodWeeks: 3,
  trend: 'neutral',
  levels: { support: 1, resistance: 2 },
  patterns: [],
  indicators: {},
  confidence: 0.8,
  limitations: [],
  summary: 'pattern summary'
}));

const runAnalystMock = vi.fn(async (): Promise<object> => ({
  ticker: 'NVDA',
  mode: 'standard',
  thesisUpdate: 'thesis',
  supportingEvidence: ['e1'],
  riskFactors: ['r1'],
  contradictions: [],
  confidence: 'high',
  confidenceReason: 'reason',
  _usage: {
    tokensIn: 220,
    tokensOut: 160,
    costUsd: 0.003
  }
}));

const runBookkeeperMock = vi.fn(async (): Promise<object> => ({
  kbEntryId: 'kb-1',
  changeType: 'initial',
  contradictionSeverity: 'none',
  snapshotCreated: false
}));

const runReporterMock = vi.fn(async (): Promise<object> => ({
  delivered: true,
  messageCount: 1,
  label: 'Report',
  failedChunkCount: 0,
  _usage: {
    tokensIn: 90,
    tokensOut: 70,
    costUsd: 0.0008
  }
}));

const runTraderMock = vi.fn(async (): Promise<object> => ({
  ticketId: 'ticket-1',
  status: 'pending_approval',
  rationale: 'rationale',
  warningText: 'warning'
}));

vi.mock('../../lib/db.js', () => ({ db: dbMock }));
vi.mock('../../lib/config.js', () => ({
  getConfig: (): {
    app: { kbFastPathFreshnessHours: number; patternDefaultPeriodWeeks: number };
    agents: {
      confidence: { reDispatchOnLow: boolean };
      manager: { primary: { provider: string; model: string } };
      researcher: { primary: { provider: string; model: string } };
      analyst: { primary: { provider: string; model: string } };
      technician: { primary: { provider: string; model: string } };
      bookkeeper: { primary: { provider: string; model: string } };
      reporter: { primary: { provider: string; model: string } };
      trader: { primary: { provider: string; model: string } };
    };
  } => ({
    app: { kbFastPathFreshnessHours: 24, patternDefaultPeriodWeeks: 3 },
    agents: {
      confidence: { reDispatchOnLow: true },
      manager: { primary: { provider: 'openai', model: 'gpt-4o' } },
      researcher: { primary: { provider: 'openai', model: 'gpt-4o' } },
      analyst: { primary: { provider: 'openai', model: 'gpt-4o' } },
      technician: { primary: { provider: 'openai', model: 'gpt-4o' } },
      bookkeeper: { primary: { provider: 'openai', model: 'gpt-4o' } },
      reporter: { primary: { provider: 'openai', model: 'gpt-4o' } },
      trader: { primary: { provider: 'openai', model: 'gpt-4o' } }
    }
  })
}));

vi.mock('../../agents/researcher.js', () => ({
  runResearcher: runResearcherMock
}));

vi.mock('../../agents/technician.js', () => ({
  runTechnician: runTechnicianMock
}));

vi.mock('../../agents/analyst.js', () => ({
  runAnalyst: runAnalystMock,
  buildTestSynthesizer: vi.fn((): (() => Promise<object>) => async (): Promise<object> => ({
    ticker: 'NVDA',
    mode: 'standard',
    thesisUpdate: 'thesis',
    supportingEvidence: ['e1'],
    riskFactors: ['r1'],
    contradictions: [],
    confidence: 'high',
    confidenceReason: 'reason',
    _usage: {
      tokensIn: 220,
      tokensOut: 160,
      costUsd: 0.003
    }
  }))
}));

vi.mock('../../agents/bookkeeper.js', () => ({
  runBookkeeper: runBookkeeperMock
}));

vi.mock('../../agents/reporter.js', () => ({
  runReporter: runReporterMock
}));

vi.mock('../../agents/trader.js', () => ({
  runTrader: runTraderMock
}));

describe('runManager', () => {
  beforeEach((): void => {
    dbMock.mission.create.mockReset();
    dbMock.mission.update.mockReset();
    dbMock.agentRun.create.mockReset();
    dbMock.kbEntry.findFirst.mockReset();
    dbMock.kbEntry.create.mockReset();
    dbMock.kbThesisSnapshot.create.mockReset();
    dbMock.tradeTicket.create.mockReset();

    runResearcherMock.mockClear();
    runTechnicianMock.mockClear();
    runAnalystMock.mockClear();
    runBookkeeperMock.mockClear();
    runReporterMock.mockClear();
    runTraderMock.mockClear();

    dbMock.mission.create.mockResolvedValue({ id: 'mission-1' });
    dbMock.mission.update.mockResolvedValue({ id: 'mission-1' });
    dbMock.agentRun.create.mockResolvedValue({ id: 'run-1' });
    dbMock.kbEntry.findFirst.mockResolvedValue(null);
    dbMock.kbEntry.create.mockResolvedValue({ id: 'kb-1' });
    dbMock.kbThesisSnapshot.create.mockResolvedValue({ id: 'snapshot-1' });
    dbMock.tradeTicket.create.mockResolvedValue({ id: 'ticket-1' });

    runAnalystMock.mockResolvedValue({
      ticker: 'NVDA',
      mode: 'standard',
      thesisUpdate: 'thesis',
      supportingEvidence: ['e1'],
      riskFactors: ['r1'],
      contradictions: [],
      confidence: 'high',
      confidenceReason: 'reason',
      _usage: {
        tokensIn: 220,
        tokensOut: 160,
        costUsd: 0.003
      }
    });
  });

  it('routes operator query through pipeline when fast-path misses', async (): Promise<void> => {
    const { runManager } = await import('../../agents/manager.js');
    const output = await runManager({ userId: 'user-1', message: 'What about NVDA?', ticker: 'NVDA', triggerType: 'user' });

    expect(output.trigger).toBe('pipeline');
    expect(output.missionType).toBe('operator_query');
    expect(output.stepsExecuted.length).toBeGreaterThan(0);

    expect(dbMock.agentRun.create).toHaveBeenCalled();
    expect(dbMock.agentRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tokensIn: expect.any(Number),
          tokensOut: expect.any(Number)
        })
      })
    );

    const nonZeroTokenRun = dbMock.agentRun.create.mock.calls.some(
      (call) => typeof call[0]?.data?.tokensIn === 'number' && call[0].data.tokensIn > 0
    );
    expect(nonZeroTokenRun).toBe(true);
  });

  it('returns kb_fast_path when fresh high-confidence thesis exists', async (): Promise<void> => {
    dbMock.kbEntry.findFirst.mockResolvedValue({
      id: 'kb-1',
      content: 'cached thesis',
      updatedAt: new Date(),
      metadata: { confidence: 'high' }
    });

    const { runManager } = await import('../../agents/manager.js');
    const output = await runManager({ userId: 'user-1', message: 'What about NVDA?', ticker: 'NVDA', triggerType: 'user' });

    expect(output.trigger).toBe('kb_fast_path');
    expect(output.response).toContain('cached');
  });

  it('rejects trade request without explicit trade params', async (): Promise<void> => {
    const { runManager } = await import('../../agents/manager.js');

    await expect(
      runManager({
        userId: 'user-1',
        missionType: 'trade_request',
        triggerType: 'user',
        ticker: 'NVDA',
        message: 'trade it'
      })
    ).rejects.toThrow('Trade request requires context.tradeAction and context.tradeQuantity');
  });

  it('accepts trade request when explicit trade params are provided', async (): Promise<void> => {
    const { runManager } = await import('../../agents/manager.js');

    const output = await runManager({
      userId: 'user-1',
      missionType: 'trade_request',
      triggerType: 'user',
      ticker: 'NVDA',
      message: 'trade it',
      context: {
        tradeAction: 'buy',
        tradeQuantity: 2
      }
    });

    expect(output.missionType).toBe('trade_request');
    expect(output.trigger).toBe('pipeline');
  });

  it('performs one re-dispatch cycle when analyst returns low confidence', async (): Promise<void> => {
    let callCount = 0;
    runAnalystMock.mockImplementation(async (): Promise<object> => {
      callCount += 1;
      return {
        ticker: 'NVDA',
        mode: 'standard',
        thesisUpdate: 'thesis',
        supportingEvidence: ['e1'],
        riskFactors: ['r1'],
        contradictions: ['contradiction-1'],
        confidence: callCount === 1 ? 'low' : 'high',
        confidenceReason: 'reason',
        _usage: {
          tokensIn: 220,
          tokensOut: 160,
          costUsd: 0.003
        }
      };
    });

    const { runManager } = await import('../../agents/manager.js');
    const output = await runManager({ userId: 'user-1', message: 'NVDA?', ticker: 'NVDA', triggerType: 'user' });

    expect(output.trigger).toBe('pipeline');
    expect(runResearcherMock).toHaveBeenCalledTimes(2);
    expect(runAnalystMock).toHaveBeenCalledTimes(2);
  });
});
