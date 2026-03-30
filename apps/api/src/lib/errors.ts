import type { Context } from 'hono';

import type { AppEnv } from '../types/hono-context.js';

export interface ErrorResponseBody {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: unknown;
  };
}

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function unauthorized(message = 'Unauthorized'): ApiError {
  return new ApiError(401, 'UNAUTHORIZED', message);
}

export function badRequest(message = 'Bad request'): ApiError {
  return new ApiError(400, 'BAD_REQUEST', message);
}

export function forbidden(message = 'Forbidden'): ApiError {
  return new ApiError(403, 'FORBIDDEN', message);
}

export function tooManyRequests(message = 'Too many requests'): ApiError {
  return new ApiError(429, 'RATE_LIMIT_EXCEEDED', message);
}

export function serviceUnavailable(message = 'Service unavailable'): ApiError {
  return new ApiError(503, 'SERVICE_UNAVAILABLE', message);
}

export function conflict(message = 'Conflict'): ApiError {
  return new ApiError(409, 'CONFLICT', message);
}

function isApiErrorLike(value: unknown): value is ApiError {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as { statusCode?: unknown; code?: unknown; message?: unknown };
  return (
    typeof candidate.statusCode === 'number' &&
    typeof candidate.code === 'string' &&
    typeof candidate.message === 'string'
  );
}
function createErrorBody(error: ApiError, requestId: string): ErrorResponseBody {
  const body: ErrorResponseBody = {
    error: {
      code: error.code,
      message: error.message,
      requestId
    }
  };

  if (error.details !== undefined) {
    body.error.details = error.details;
  }

  return body;
}

export function toErrorResponse(c: Context<AppEnv>, rawError: unknown): Response {
  const requestId = c.get('requestId') ?? 'unknown';
  c.header('x-request-id', requestId);

  if (isApiErrorLike(rawError)) {
    return new Response(JSON.stringify(createErrorBody(rawError, requestId)), {
      status: rawError.statusCode,
      headers: { 'content-type': 'application/json' }
    });
  }

  const fallback = new ApiError(500, 'INTERNAL_ERROR', 'Internal server error');
  return new Response(JSON.stringify(createErrorBody(fallback, requestId)), {
    status: 500,
    headers: { 'content-type': 'application/json' }
  });
}




