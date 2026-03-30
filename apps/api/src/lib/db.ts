import { PrismaClient } from '@prisma/client';

interface GlobalPrismaCache {
  prisma?: PrismaClient;
}

const globalCache = globalThis as typeof globalThis & GlobalPrismaCache;

export const db: PrismaClient = globalCache.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalCache.prisma = db;
}

export interface KbSimilarityRow {
  id: string;
  ticker: string | null;
  entryType: string;
  content: string;
  distance: number;
}

function escapeVectorLiteral(vectorLiteral: string): string {
  return vectorLiteral.replace(/'/g, "''");
}

export function buildKbCosineSimilaritySql(vectorLiteral: string, limit: number): string {
  const safeVector = escapeVectorLiteral(vectorLiteral);
  const normalizedLimit = Math.max(1, Math.floor(limit));

  return [
    'SELECT',
    '  id,',
    '  ticker,',
    '  "entryType",',
    '  content,',
    `  (embedding <=> '${safeVector}'::vector) AS distance`,
    'FROM "KbEntry"',
    'WHERE embedding IS NOT NULL',
    `ORDER BY embedding <=> '${safeVector}'::vector ASC`,
    `LIMIT ${String(normalizedLimit)}`
  ].join('\n');
}

export async function queryKbEntriesByCosineSimilarity(
  vectorLiteral: string,
  limit = 5
): Promise<KbSimilarityRow[]> {
  const sql = buildKbCosineSimilaritySql(vectorLiteral, limit);
  return db.$queryRawUnsafe<KbSimilarityRow[]>(sql);
}
