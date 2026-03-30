import { z } from 'zod';

import { logger } from '../lib/logger.js';
import type {
  McpServerDefinition,
  ToolInvocationError,
  ToolInvocationFailureEnvelope,
  ToolInvocationRequest,
  ToolInvocationResultEnvelope,
  ToolInvocationSuccessEnvelope
} from '../types/agent-infrastructure.js';

const TOOL_INVOCATION_REQUEST_SCHEMA = z.object({
  tool: z.string().min(1),
  input: z.unknown()
}).strict();

const TOOL_INVOCATION_SUCCESS_SCHEMA = z.object({
  output: z.unknown(),
  durationMs: z.number().int().nonnegative().optional()
}).strict();

const TOOL_INVOCATION_FAILURE_SCHEMA = z.object({
  error: z.object({
    code: z.enum(['UPSTREAM_ERROR', 'TIMEOUT', 'VALIDATION_ERROR', 'UNAVAILABLE']),
    message: z.string().min(1),
    sourceServer: z.string().min(1),
    retryable: z.boolean()
  }).strict(),
  durationMs: z.number().int().nonnegative().optional()
}).strict();

export interface InvokeMcpToolOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export function validateToolInvocationRequest(payload: unknown): ToolInvocationRequest {
  const parsed = TOOL_INVOCATION_REQUEST_SCHEMA.parse(payload) as { tool: string; input?: unknown };

  if (!Object.prototype.hasOwnProperty.call(parsed, 'input')) {
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        path: ['input'],
        message: "Required property 'input' is missing."
      }
    ]);
  }

  return {
    tool: parsed.tool,
    input: parsed.input
  };
}

export function createToolInvocationSuccessEnvelope(output: unknown, durationMs: number): ToolInvocationSuccessEnvelope {
  return {
    output,
    durationMs
  };
}

export function createToolInvocationFailureEnvelope(error: ToolInvocationError, durationMs: number): ToolInvocationFailureEnvelope {
  return {
    error,
    durationMs
  };
}

function toErrorEnvelope(
  code: ToolInvocationError['code'],
  message: string,
  sourceServer: string,
  retryable: boolean,
  durationMs: number
): ToolInvocationFailureEnvelope {
  return createToolInvocationFailureEnvelope(
    {
      code,
      message,
      sourceServer,
      retryable
    },
    durationMs
  );
}

function parseInvocationResponse(responseBody: unknown, serverName: string, durationMs: number): ToolInvocationResultEnvelope {
  const success = TOOL_INVOCATION_SUCCESS_SCHEMA.safeParse(responseBody);
  if (success.success) {
    return createToolInvocationSuccessEnvelope(success.data.output, success.data.durationMs ?? durationMs);
  }

  const failure = TOOL_INVOCATION_FAILURE_SCHEMA.safeParse(responseBody);
  if (failure.success) {
    return createToolInvocationFailureEnvelope(
      {
        code: failure.data.error.code,
        message: failure.data.error.message,
        sourceServer: failure.data.error.sourceServer,
        retryable: failure.data.error.retryable
      },
      failure.data.durationMs ?? durationMs
    );
  }

  return toErrorEnvelope(
    'VALIDATION_ERROR',
    'Invocation response did not match success or failure envelope.',
    serverName,
    false,
    durationMs
  );
}

export async function invokeMcpTool(
  server: McpServerDefinition,
  payload: unknown,
  options?: InvokeMcpToolOptions
): Promise<ToolInvocationResultEnvelope> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const timeoutMs = options?.timeoutMs ?? server.timeoutMs;

  const startedAtMs = Date.now();

  try {
    const request = validateToolInvocationRequest(payload);
    const response = await fetchImpl(`${server.url}/mcp/invoke`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(timeoutMs)
    });

    let responseBody: unknown;
    try {
      responseBody = (await response.json()) as unknown;
    } catch {
      const durationMs = Date.now() - startedAtMs;
      const envelope = toErrorEnvelope(
        'VALIDATION_ERROR',
        'Invocation response was not valid JSON.',
        server.name,
        false,
        durationMs
      );

      logger.warn(
        {
          serverName: server.name,
          tool: request.tool,
          code: envelope.error.code,
          durationMs
        },
        'MCP invocation returned invalid JSON'
      );

      return envelope;
    }

    const durationMs = Date.now() - startedAtMs;

    if (!response.ok) {
      const failureEnvelope = toErrorEnvelope(
        'UPSTREAM_ERROR',
        `MCP invoke failed with status ${String(response.status)}.`,
        server.name,
        response.status >= 500,
        durationMs
      );

      logger.warn(
        {
          serverName: server.name,
          tool: request.tool,
          status: response.status,
          durationMs
        },
        'MCP invocation upstream error'
      );

      return failureEnvelope;
    }

    const parsed = parseInvocationResponse(responseBody, server.name, durationMs);
    if ('error' in parsed) {
      logger.warn(
        {
          serverName: server.name,
          tool: request.tool,
          code: parsed.error.code,
          durationMs: parsed.durationMs
        },
        'MCP invocation returned structured failure envelope'
      );
    }

    return parsed;
  } catch (error) {
    const durationMs = Date.now() - startedAtMs;

    if (error instanceof z.ZodError) {
      const envelope = toErrorEnvelope(
        'VALIDATION_ERROR',
        `Invalid tool invocation payload: ${error.issues.map((issue) => issue.path.join('.')).join(', ') || 'unknown path'}.`,
        server.name,
        false,
        durationMs
      );

      logger.warn(
        {
          serverName: server.name,
          code: envelope.error.code,
          durationMs
        },
        'MCP invocation payload validation failed'
      );

      return envelope;
    }

    const isTimeout = error instanceof Error && error.name === 'TimeoutError';

    const envelope = toErrorEnvelope(
      isTimeout ? 'TIMEOUT' : 'UNAVAILABLE',
      isTimeout ? 'MCP invocation timed out.' : `MCP invocation failed: ${(error as Error).message}`,
      server.name,
      true,
      durationMs
    );

    logger.warn(
      {
        serverName: server.name,
        code: envelope.error.code,
        durationMs
      },
      'MCP invocation failed'
    );

    return envelope;
  }
}