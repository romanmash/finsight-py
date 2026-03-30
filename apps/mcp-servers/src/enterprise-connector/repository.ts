import type { PrismaClient } from '@prisma/client';

export interface EnterpriseSearchQuery {
  sourceType: 'sharepoint' | 'email';
  query: string;
  ticker?: string;
}

export interface EnterpriseSearchItem {
  id: string;
  sourceType: 'sharepoint' | 'email';
  title: string;
  excerpt: string;
  timestamp: string;
  owner: string;
  ticker: string;
}

export interface EnterpriseRepository {
  search(query: EnterpriseSearchQuery): Promise<EnterpriseSearchItem[]>;
}

function parseSourceType(value: unknown): 'sharepoint' | 'email' | null {
  if (value === 'sharepoint' || value === 'email') {
    return value;
  }

  return null;
}

function parseOwner(value: unknown): string {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }

  return 'unknown';
}

export class PrismaEnterpriseRepository implements EnterpriseRepository {
  private readonly db: PrismaClient;

  constructor(db: PrismaClient) {
    this.db = db;
  }

  async search(query: EnterpriseSearchQuery): Promise<EnterpriseSearchItem[]> {
    const rows = await this.db.kbEntry.findMany({
      where: {
        entryType: 'enterprise_artifact',
        ...(query.ticker ? { ticker: query.ticker } : {}),
        content: {
          contains: query.query,
          mode: 'insensitive'
        }
      },
      select: {
        id: true,
        ticker: true,
        content: true,
        metadata: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 50
    });

    return rows.flatMap((row) => {
      if (typeof row.ticker !== 'string' || row.ticker.length === 0) {
        return [];
      }

      const metadata = typeof row.metadata === 'object' && row.metadata !== null ? (row.metadata as Record<string, unknown>) : {};
      const sourceType = parseSourceType(metadata.sourceType);

      if (sourceType === null || sourceType !== query.sourceType) {
        return [];
      }

      const titleValue = metadata.title;
      const excerptValue = metadata.excerpt;
      const owner = parseOwner(metadata.owner);

      const item: EnterpriseSearchItem = {
        id: row.id,
        sourceType,
        title: typeof titleValue === 'string' && titleValue.length > 0 ? titleValue : row.content.slice(0, 60),
        excerpt: typeof excerptValue === 'string' && excerptValue.length > 0 ? excerptValue : row.content.slice(0, 240),
        timestamp: row.createdAt.toISOString(),
        owner,
        ticker: row.ticker
      };

      return [item];
    });
  }
}
