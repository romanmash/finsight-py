import { beforeEach, describe, expect, it, vi } from 'vitest';

interface MockPrismaClient {
  user: {
    findMany: () => Promise<unknown[]>;
  };
  $queryRawUnsafe: (sql: string) => Promise<unknown[]>;
}

const findManyMock = vi.fn<() => Promise<unknown[]>>().mockResolvedValue([]);
const queryRawUnsafeMock = vi.fn<(sql: string) => Promise<unknown[]>>().mockResolvedValue([]);
const prismaConstructorMock = vi.fn<() => MockPrismaClient>(() => ({
  user: {
    findMany: findManyMock
  },
  $queryRawUnsafe: queryRawUnsafeMock
}));

vi.mock('@prisma/client', () => ({
  PrismaClient: prismaConstructorMock
}));

interface DbModule {
  db: {
    user: {
      findMany: () => Promise<unknown[]>;
    };
  };
  buildKbCosineSimilaritySql: (vectorLiteral: string, limit: number) => string;
  queryKbEntriesByCosineSimilarity: (vectorLiteral: string, limit?: number) => Promise<unknown[]>;
}

async function loadDbModule(): Promise<DbModule> {
  vi.resetModules();
  return import('../db.js') as Promise<DbModule>;
}

describe('db singleton', () => {
  beforeEach(() => {
    findManyMock.mockClear();
    queryRawUnsafeMock.mockClear();
    prismaConstructorMock.mockClear();
    delete (globalThis as Record<string, unknown>).prisma;
  });

  it('reuses a singleton Prisma client instance across imports', async () => {
    const first = await loadDbModule();
    const second = await loadDbModule();

    expect(first.db).toBe(second.db);
    expect(prismaConstructorMock).toHaveBeenCalledTimes(1);
  });

  it('supports db.user.findMany() smoke query contract', async () => {
    const module = await loadDbModule();

    await expect(module.db.user.findMany()).resolves.toEqual([]);
    expect(findManyMock).toHaveBeenCalledTimes(1);
  });

  it('builds and executes pgvector cosine similarity query for KbEntry.embedding', async () => {
    const module = await loadDbModule();

    const sql = module.buildKbCosineSimilaritySql('[0.1,0.2,0.3]', 3);
    expect(sql).toContain('"KbEntry"');
    expect(sql).toContain('embedding <=>');
    expect(sql).toContain('::vector');

    await module.queryKbEntriesByCosineSimilarity('[0.1,0.2,0.3]', 3);
    expect(queryRawUnsafeMock).toHaveBeenCalledTimes(1);
  });
});
