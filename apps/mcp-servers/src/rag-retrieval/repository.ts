import type { PrismaClient } from '@prisma/client';

export interface RetrievalSearchQuery {
  query: string;
  limit: number;
  ticker?: string;
  entryType?: string;
  since?: string;
}

export interface RetrievalSearchItem {
  id: string;
  ticker: string;
  entryType: string;
  summary: string;
  createdAt: string;
  scoreBase: number;
}

export interface CurrentThesisItem {
  ticker: string;
  thesis: string;
  confidence: string;
  updatedAt: string;
}

export interface ThesisHistoryItem {
  id: string;
  thesis: string;
  confidence: string;
  createdAt: string;
}

export interface RetrievalRepository {
  search(query: RetrievalSearchQuery): Promise<RetrievalSearchItem[]>;
  getCurrentThesis(ticker: string): Promise<CurrentThesisItem | null>;
  getThesisHistory(ticker: string): Promise<ThesisHistoryItem[]>;
}

export class PrismaRetrievalRepository implements RetrievalRepository {
  private readonly db: PrismaClient;

  constructor(db: PrismaClient) {
    this.db = db;
  }

  async search(query: RetrievalSearchQuery): Promise<RetrievalSearchItem[]> {
    const rows = await this.db.kbEntry.findMany({
      where: {
        ...(query.ticker ? { ticker: query.ticker } : {}),
        ...(query.entryType ? { entryType: query.entryType } : {}),
        ...(query.since ? { createdAt: { gte: new Date(query.since) } } : {}),
        OR: [
          { content: { contains: query.query, mode: 'insensitive' } }
        ]
      },
      select: {
        id: true,
        ticker: true,
        entryType: true,
        content: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: query.limit * 4
    });

    return rows
      .filter((row) => typeof row.ticker === 'string' && row.ticker.length > 0)
      .map((row) => ({
        id: row.id,
        ticker: row.ticker as string,
        entryType: row.entryType,
        summary: row.content.slice(0, 280),
        createdAt: row.createdAt.toISOString(),
        scoreBase: 0.8
      }));
  }

  async getCurrentThesis(ticker: string): Promise<CurrentThesisItem | null> {
    const row = await this.db.kbThesisSnapshot.findFirst({
      where: { ticker },
      orderBy: { createdAt: 'desc' },
      select: {
        ticker: true,
        thesis: true,
        confidence: true,
        createdAt: true
      }
    });

    if (!row) {
      return null;
    }

    return {
      ticker: row.ticker,
      thesis: row.thesis,
      confidence: row.confidence,
      updatedAt: row.createdAt.toISOString()
    };
  }

  async getThesisHistory(ticker: string): Promise<ThesisHistoryItem[]> {
    const rows = await this.db.kbThesisSnapshot.findMany({
      where: { ticker },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        thesis: true,
        confidence: true,
        createdAt: true
      }
    });

    return rows.map((row) => ({
      id: row.id,
      thesis: row.thesis,
      confidence: row.confidence,
      createdAt: row.createdAt.toISOString()
    }));
  }
}
