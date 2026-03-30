import type { McpConfig, RagConfig, TraderConfig } from '../../../../config/types/index.js';

export const mcpConfigFixture: McpConfig = {
  invoke: {
    defaultTimeoutMs: 500,
    defaultRetry: {
      maxAttempts: 2,
      backoffMs: 1
    }
  },
  providers: {
    marketDataBaseUrl: 'https://market-data.test',
    fmpBaseUrl: 'https://fmp.test',
    gdeltBaseUrl: 'https://gdelt.test',
    alphaVantageBaseUrl: 'https://alpha-vantage.test/query',
    newsBaseUrl: 'https://news.test'
  },
  retrieval: {
    vectorWeight: 0.7,
    bm25Weight: 0.3,
    rrfK: 60
  },
  trader: {
    requireApprovalForNonMock: true
  },
  servers: {
    marketData: {
      url: 'http://market-data-mcp:3001',
      timeoutMs: 500,
      retry: { maxAttempts: 2, backoffMs: 1 },
      cache: { quoteTtlSec: 60, fundamentalsTtlSec: 60, earningsTtlSec: 60, ratingsTtlSec: 60 }
    },
    macroSignals: {
      url: 'http://macro-signals-mcp:3002',
      timeoutMs: 500,
      retry: { maxAttempts: 2, backoffMs: 1 },
      cache: { gdeltTtlSec: 60, ecoCalendarTtlSec: 60, indicatorTtlSec: 60 }
    },
    news: {
      url: 'http://news-mcp:3003',
      timeoutMs: 500,
      retry: { maxAttempts: 2, backoffMs: 1 },
      cache: { latestTtlSec: 60, sentimentTtlSec: 60 }
    },
    ragRetrieval: {
      url: 'http://rag-retrieval-mcp:3004',
      timeoutMs: 500,
      retry: { maxAttempts: 1, backoffMs: 0 }
    },
    enterpriseConnector: {
      url: 'http://enterprise-connector-mcp:3005',
      timeoutMs: 500,
      retry: { maxAttempts: 1, backoffMs: 0 }
    },
    traderPlatform: {
      url: 'http://trader-platform-mcp:3006',
      timeoutMs: 500,
      retry: { maxAttempts: 1, backoffMs: 0 }
    }
  }
};

export const ragConfigFixture: RagConfig = {
  embeddingModel: 'text-embedding-3-small',
  embeddingDimensions: 1536,
  chunkSize: 512,
  chunkOverlap: 64,
  topK: 8,
  bm25Weight: 0.3,
  freshnessBoostDays: 7,
  rrfK: 60,
  maxThesisAgeHours: 24
};

export const traderConfigFixture: TraderConfig = {
  ticketExpiryHours: 24,
  minConfidenceToCreateTicket: 'medium',
  maxPendingTicketsPerUser: 5,
  mockExecutionSlippagePct: 0.05,
  mockBasePrice: 100,
  allowedRoles: ['admin', 'analyst'],
  requireTechnicianAlignment: false,
  platform: 'mock'
};

