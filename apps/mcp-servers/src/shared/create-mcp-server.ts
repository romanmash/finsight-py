import { randomUUID } from 'node:crypto';

import { Hono } from 'hono';
import pino from 'pino';
import { z } from 'zod';

import { createNotFoundError, createValidationError, toErrorEnvelope, toMcpToolError } from './errors.js';
import type { McpAnyToolDefinition, McpFailureEnvelope, McpServerOptions, McpSuccessEnvelope } from './tool-types.js';
import { invokeRequestSchema } from './tool-types.js';

interface ZodSchemaDef {
  typeName?: string;
}

function serializeSchema(schema: z.ZodTypeAny): unknown {
  const schemaDef = schema._def as ZodSchemaDef;
  return {
    zodType: schemaDef.typeName ?? 'ZodUnknown'
  };
}

function assertNoDuplicateToolNames(tools: ReadonlyArray<McpAnyToolDefinition>): void {
  const seen = new Set<string>();

  for (const tool of tools) {
    if (seen.has(tool.name)) {
      throw createValidationError(`Duplicate tool registration detected: ${tool.name}`);
    }

    seen.add(tool.name);
  }
}

export function createMcpServer(options: McpServerOptions): Hono {
  assertNoDuplicateToolNames(options.tools);

  const logger = pino({
    name: options.serviceName,
    level: process.env.LOG_LEVEL ?? 'info'
  });

  const startedAtMs = Date.now();
  const app = new Hono();
  const toolByName = new Map(options.tools.map((tool) => [tool.name, tool] as const));

  app.get('/health', (c) => {
    const uptimeSeconds = Math.floor((Date.now() - startedAtMs) / 1000);
    return c.json({
      status: 'ok',
      service: options.serviceName,
      uptimeSeconds
    });
  });

  app.get('/mcp/tools', (c) => {
    return c.json({
      tools: options.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: serializeSchema(tool.inputSchema),
        outputSchema: serializeSchema(tool.outputSchema)
      }))
    });
  });

  app.post('/mcp/invoke', async (c) => {
    const requestId = c.req.header('x-request-id') ?? randomUUID();
    const started = performance.now();
    let resolvedToolName = 'unknown';

    try {
      const body = await c.req.json();
      const parsed = invokeRequestSchema.safeParse(body);
      if (!parsed.success) {
        throw createValidationError('Input schema validation failed', parsed.error.issues);
      }

      const tool = toolByName.get(parsed.data.tool);
      if (!tool) {
        throw createNotFoundError(`Tool not found: ${parsed.data.tool}`);
      }
      resolvedToolName = tool.name;

      const parsedInput = tool.inputSchema.safeParse(parsed.data.input);
      if (!parsedInput.success) {
        throw createValidationError('Input schema validation failed', parsedInput.error.issues);
      }

      const output = await tool.handler(parsedInput.data, {
        requestId,
        service: options.serviceName,
        c
      });

      const parsedOutput = tool.outputSchema.safeParse(output);
      if (!parsedOutput.success) {
        throw createValidationError('Output schema validation failed', parsedOutput.error.issues);
      }

      const durationMs = Math.round(performance.now() - started);
      logger.info({ requestId, server: options.serviceName, tool: tool.name, status: 'ok', durationMs }, 'MCP invocation completed');

      const response: McpSuccessEnvelope<unknown> = {
        output: parsedOutput.data,
        durationMs
      };

      return c.json(response, 200);
    } catch (error) {
      const durationMs = Math.round(performance.now() - started);
      const mcpError = toMcpToolError(error);
      logger.error(
        {
          requestId,
          server: options.serviceName,
          tool: resolvedToolName,
          status: 'error',
          durationMs,
          errorCode: mcpError.code,
          error
        },
        'MCP invocation failed'
      );

      const failure: McpFailureEnvelope = {
        error: toErrorEnvelope(mcpError),
        durationMs
      };

      return c.json(failure, mcpError.status);
    }
  });

  return app;
}
