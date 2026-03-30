import { setTimeout as sleep } from 'node:timers/promises';

import type { ContentfulStatusCode } from 'hono/utils/http-status';

import type { McpErrorCode, McpErrorEnvelope } from './tool-types.js';

const INTERNAL_ERROR_MESSAGE = 'Internal server error';

export class McpToolError extends Error {
  readonly code: McpErrorCode;
  readonly status: ContentfulStatusCode;
  readonly details?: unknown;

  constructor(code: McpErrorCode, message: string, status: ContentfulStatusCode, details?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function createValidationError(message: string, details?: unknown): McpToolError {
  return new McpToolError('VALIDATION_ERROR', message, 400, details);
}

export function createNotFoundError(message: string): McpToolError {
  return new McpToolError('TOOL_NOT_FOUND', message, 404);
}

export function createTimeoutError(message: string, details?: unknown): McpToolError {
  return new McpToolError('TIMEOUT', message, 504, details);
}

export function createConfigError(message: string, details?: unknown): McpToolError {
  return new McpToolError('CONFIG_ERROR', message, 500, details);
}

export function createAuthorizationError(message: string, details?: unknown): McpToolError {
  return new McpToolError('AUTHORIZATION_ERROR', message, 403, details);
}

export function createUpstreamError(message: string, details?: unknown): McpToolError {
  return new McpToolError('UPSTREAM_ERROR', message, 502, details);
}

export function toMcpToolError(error: unknown): McpToolError {
  if (error instanceof McpToolError) {
    return error;
  }

  if (error instanceof Error && error.name === 'AbortError') {
    return createTimeoutError('Upstream request timed out');
  }

  if (error instanceof Error) {
    return new McpToolError('INTERNAL_ERROR', error.message || INTERNAL_ERROR_MESSAGE, 500);
  }

  return new McpToolError('INTERNAL_ERROR', INTERNAL_ERROR_MESSAGE, 500);
}

export function toErrorEnvelope(error: McpToolError): McpErrorEnvelope {
  return {
    code: error.code,
    message: error.message,
    ...(error.details === undefined ? {} : { details: error.details })
  };
}

export async function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> {
  return await Promise.race([
    operation(),
    (async (): Promise<T> => {
      await sleep(timeoutMs);
      throw createTimeoutError(timeoutMessage, { timeoutMs });
    })()
  ]);
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  maxAttempts: number,
  backoffMs: number
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await sleep(backoffMs);
      }
    }
  }

  throw lastError;
}

