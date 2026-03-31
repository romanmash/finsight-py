import { db } from '../../lib/db.js';

export interface CurrentThesisContext {
  content: string;
  confidence: 'low' | 'medium' | 'high';
  updatedAt: string;
}

export function extractConfidenceFromMetadata(metadata: unknown): 'low' | 'medium' | 'high' {
  const record = typeof metadata === 'object' && metadata !== null ? (metadata as Record<string, unknown>) : {};
  const raw = record['confidence'];

  return raw === 'high' || raw === 'medium' || raw === 'low' ? raw : 'medium';
}

export async function getCurrentThesisContext(ticker: string): Promise<CurrentThesisContext | null> {
  const record = await db.kbEntry.findFirst({
    where: {
      ticker
    },
    orderBy: {
      updatedAt: 'desc'
    }
  });

  if (record === null) {
    return null;
  }

  const confidence = extractConfidenceFromMetadata(record.metadata);

  return {
    content: record.content,
    confidence,
    updatedAt: record.updatedAt.toISOString()
  };
}

export async function getPortfolioQuantity(userId: string, ticker: string): Promise<number> {
  const item = await db.portfolioItem.findUnique({
    where: {
      userId_ticker: {
        userId,
        ticker
      }
    }
  });

  return item?.quantity ?? 0;
}
