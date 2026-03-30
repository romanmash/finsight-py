import { z } from 'zod';

import type { McpConfig, RagConfig } from '../../../../../config/types/index.js';
import { getPrismaClient } from '../../shared/db.js';
import type { McpAnyToolDefinition, McpToolDefinition } from '../../shared/tool-types.js';
import { PrismaRetrievalRepository, type RetrievalRepository } from '../repository.js';

const searchInputSchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().positive().max(20).optional(),
  ticker: z.string().optional(),
  entryType: z.string().optional(),
  since: z.string().optional()
}).strict();

const searchOutputSchema = z.object({
  items: z.array(z.object({
    id: z.string(),
    ticker: z.string(),
    entryType: z.string(),
    score: z.number(),
    summary: z.string(),
    createdAt: z.string()
  }).strict())
}).strict();

const thesisInputSchema = z.object({ ticker: z.string().min(1) }).strict();
const currentThesisOutputSchema = z.object({ ticker: z.string(), thesis: z.string(), confidence: z.string(), updatedAt: z.string() }).nullable();
const thesisHistoryOutputSchema = z.object({
  ticker: z.string(),
  items: z.array(z.object({ id: z.string(), thesis: z.string(), confidence: z.string(), createdAt: z.string() }).strict())
}).strict();

interface RagRetrievalOptions {
  repository?: RetrievalRepository;
}

function computeScore(baseScore: number, query: string, text: string, mcpConfig: McpConfig, ragConfig: RagConfig): number {
  const vectorWeight = mcpConfig.retrieval?.vectorWeight ?? (1 - ragConfig.bm25Weight);
  const bm25Weight = mcpConfig.retrieval?.bm25Weight ?? ragConfig.bm25Weight;
  const contains = text.toLowerCase().includes(query.toLowerCase()) ? 1 : 0.3;
  return Number((baseScore * vectorWeight + contains * bm25Weight).toFixed(6));
}

export function createRagRetrievalToolRegistry(
  mcpConfig: McpConfig,
  ragConfig: RagConfig,
  options: RagRetrievalOptions = {}
): ReadonlyArray<McpAnyToolDefinition> {
  const repository = options.repository ?? new PrismaRetrievalRepository(getPrismaClient());

  const search: McpToolDefinition<z.infer<typeof searchInputSchema>, z.infer<typeof searchOutputSchema>> = {
    name: 'search',
    description: 'Search knowledge base entries with optional filters',
    inputSchema: searchInputSchema,
    outputSchema: searchOutputSchema,
    handler: async (input) => {
      const limit = input.limit ?? ragConfig.topK;
      const rows = await repository.search({
        query: input.query,
        limit,
        ...(input.ticker ? { ticker: input.ticker } : {}),
        ...(input.entryType ? { entryType: input.entryType } : {}),
        ...(input.since ? { since: input.since } : {})
      });

      const items = rows
        .map((item) => ({
          ...item,
          score: computeScore(item.scoreBase, input.query, item.summary, mcpConfig, ragConfig)
        }))
        .sort((a, b) => {
          if (b.score !== a.score) {
            return b.score - a.score;
          }

          return a.id.localeCompare(b.id);
        })
        .slice(0, limit)
        .map((item) => ({
          id: item.id,
          ticker: item.ticker,
          entryType: item.entryType,
          score: item.score,
          summary: item.summary,
          createdAt: item.createdAt
        }));

      return { items };
    }
  };

  const getCurrentThesis: McpToolDefinition<z.infer<typeof thesisInputSchema>, z.infer<typeof currentThesisOutputSchema>> = {
    name: 'get_current_thesis',
    description: 'Get latest thesis for a ticker',
    inputSchema: thesisInputSchema,
    outputSchema: currentThesisOutputSchema,
    handler: async (input) => {
      return await repository.getCurrentThesis(input.ticker);
    }
  };

  const getThesisHistory: McpToolDefinition<z.infer<typeof thesisInputSchema>, z.infer<typeof thesisHistoryOutputSchema>> = {
    name: 'get_thesis_history',
    description: 'Get thesis history for a ticker',
    inputSchema: thesisInputSchema,
    outputSchema: thesisHistoryOutputSchema,
    handler: async (input) => {
      const items = await repository.getThesisHistory(input.ticker);
      return { ticker: input.ticker, items };
    }
  };

  return [search, getCurrentThesis, getThesisHistory] as ReadonlyArray<McpAnyToolDefinition>;
}
