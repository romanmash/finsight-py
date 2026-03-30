import { beforeEach, describe, expect, it, vi } from 'vitest';

const mgetMock = vi.fn();
const getMock = vi.fn();
const setMock = vi.fn();
const pingMock = vi.fn();

const agentRunFindManyMock = vi.fn();
const agentRunGroupByMock = vi.fn();
const missionFindFirstMock = vi.fn();
const missionFindManyMock = vi.fn();
const kbCountMock = vi.fn();
const kbFindFirstMock = vi.fn();
const kbFindManyMock = vi.fn();
const queryRawMock = vi.fn();

const queueCountMock = vi.fn();

vi.mock('../redis.js', () => ({
  RedisKey: {
    agentState: (name: string): string => `agent:state:${name}`
  },
  redis: {
    mget: mgetMock,
    get: getMock,
    set: setMock,
    ping: pingMock
  }
}));

vi.mock('../db.js', () => ({
  db: {
    agentRun: {
      findMany: agentRunFindManyMock,
      groupBy: agentRunGroupByMock
    },
    mission: {
      findFirst: missionFindFirstMock,
      findMany: missionFindManyMock
    },
    kbEntry: {
      count: kbCountMock,
      findFirst: kbFindFirstMock,
      findMany: kbFindManyMock
    },
    $queryRaw: queryRawMock
  }
}));

vi.mock('../queues.js', () => ({
  watchdogScanQueue: { getJobCounts: queueCountMock },
  screenerScanQueue: { getJobCounts: queueCountMock },
  dailyBriefQueue: { getJobCounts: queueCountMock },
  earningsCheckQueue: { getJobCounts: queueCountMock },
  ticketExpiryQueue: { getJobCounts: queueCountMock },
  alertPipelineQueue: { getJobCounts: queueCountMock }
}));

vi.mock('../config.js', () => ({
  getConfig: (): { mcp: { servers: { marketData: { url: string } } } } => ({
    mcp: {
      servers: {
        marketData: { url: 'http://localhost:3001' }
      }
    }
  })
}));

describe('status aggregation', () => {
  beforeEach(() => {
    vi.resetModules();
    mgetMock.mockResolvedValue(Array.from({ length: 9 }, () => null));
    getMock.mockResolvedValue(null);
    setMock.mockResolvedValue('OK');
    pingMock.mockResolvedValue('PONG');

    agentRunFindManyMock.mockResolvedValue([]);
    agentRunGroupByMock.mockResolvedValue([]);
    missionFindFirstMock.mockResolvedValue(null);
    missionFindManyMock.mockResolvedValue([]);
    kbCountMock.mockResolvedValue(0);
    kbFindFirstMock.mockResolvedValue(null);
    kbFindManyMock.mockResolvedValue([]);
    queryRawMock.mockResolvedValue([{ '?column?': 1 }]);

    queueCountMock.mockResolvedValue({ waiting: 0, active: 0, delayed: 0 });

    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 }) as unknown as typeof fetch;
  });

  it('returns snapshot containing all 9 agent slots', async () => {
    const { buildAdminStatusSnapshot } = await import('../status-aggregation.js');
    const status = await buildAdminStatusSnapshot(new Date('2026-03-30T00:00:00.000Z'));

    expect(Object.keys(status.agents)).toHaveLength(9);
  });

  it('returns degraded snapshot on timeout budget breach', async () => {
    process.env.ADMIN_STATUS_TIMEOUT_MS = '1';
    mgetMock.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(Array.from({ length: 9 }, () => null)), 25)));

    const { buildAdminStatusSnapshot } = await import('../status-aggregation.js');
    const status = await buildAdminStatusSnapshot(new Date('2026-03-30T00:00:00.000Z'));

    expect(status.degraded).toBe(true);
    delete process.env.ADMIN_STATUS_TIMEOUT_MS;
  });
});




