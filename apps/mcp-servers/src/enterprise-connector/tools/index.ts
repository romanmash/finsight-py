import { z } from 'zod';

import { getPrismaClient } from '../../shared/db.js';
import type { McpAnyToolDefinition, McpToolDefinition } from '../../shared/tool-types.js';
import { PrismaEnterpriseRepository, type EnterpriseRepository } from '../repository.js';

const sharepointInputSchema = z.object({
  query: z.string().min(1),
  ticker: z.string().optional()
}).strict();

const emailInputSchema = z.object({
  query: z.string().min(1),
  ticker: z.string().optional()
}).strict();

const artifactSchema = z.object({
  id: z.string(),
  sourceType: z.enum(['sharepoint', 'email']),
  title: z.string(),
  excerpt: z.string(),
  timestamp: z.string(),
  owner: z.string(),
  ticker: z.string()
}).strict();

const outputSchema = z.object({
  items: z.array(artifactSchema)
}).strict();

export interface EnterpriseConnectorToolRegistryOptions {
  repository?: EnterpriseRepository;
}

export function createEnterpriseConnectorToolRegistry(
  options: EnterpriseConnectorToolRegistryOptions = {}
): ReadonlyArray<McpToolDefinition<unknown, unknown>> {
  const repository = options.repository ?? new PrismaEnterpriseRepository(getPrismaClient());

  const sharepointSearch: McpToolDefinition<z.infer<typeof sharepointInputSchema>, z.infer<typeof outputSchema>> = {
    name: 'sharepoint_search',
    description: 'Search enterprise SharePoint documents',
    inputSchema: sharepointInputSchema,
    outputSchema,
    handler: async (input) => ({
      items: await repository.search({
        sourceType: 'sharepoint',
        query: input.query,
        ...(input.ticker ? { ticker: input.ticker } : {})
      })
    })
  };

  const searchEmails: McpToolDefinition<z.infer<typeof emailInputSchema>, z.infer<typeof outputSchema>> = {
    name: 'search_emails',
    description: 'Search enterprise email artifacts',
    inputSchema: emailInputSchema,
    outputSchema,
    handler: async (input) => ({
      items: await repository.search({
        sourceType: 'email',
        query: input.query,
        ...(input.ticker ? { ticker: input.ticker } : {})
      })
    })
  };

  return [sharepointSearch, searchEmails] as ReadonlyArray<McpAnyToolDefinition>;
}
