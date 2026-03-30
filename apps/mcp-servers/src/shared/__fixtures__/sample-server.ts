import { z } from 'zod';

import { createMcpServer } from '../create-mcp-server.js';
import type { McpAnyToolDefinition, McpToolDefinition } from '../tool-types.js';

const echoTool: McpToolDefinition<{ value: string }, { echoed: string }> = {
  name: 'echo',
  description: 'Echoes a value',
  inputSchema: z.object({ value: z.string().min(1) }).strict(),
  outputSchema: z.object({ echoed: z.string() }).strict(),
  handler: async (input): Promise<{ echoed: string }> => ({ echoed: input.value })
};

export function createSampleServer(): import('hono').Hono {
  return createMcpServer({
    serviceName: 'sample-mcp',
    tools: [echoTool] as ReadonlyArray<McpAnyToolDefinition>
  });
}

