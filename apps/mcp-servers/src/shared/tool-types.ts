import type { Context } from 'hono';
import { z } from 'zod';

export const invokeRequestSchema = z.object({
  tool: z.string().min(1),
  input: z.unknown().default({})
}).strict();

export type InvokeRequest = z.infer<typeof invokeRequestSchema>;

export type McpErrorCode =
  | 'VALIDATION_ERROR'
  | 'TOOL_NOT_FOUND'
  | 'UPSTREAM_ERROR'
  | 'TIMEOUT'
  | 'CONFIG_ERROR'
  | 'AUTHORIZATION_ERROR'
  | 'INTERNAL_ERROR';

export interface McpErrorEnvelope {
  code: McpErrorCode;
  message: string;
  details?: unknown;
}

export interface McpSuccessEnvelope<TOutput> {
  output: TOutput;
  durationMs: number;
}

export interface McpFailureEnvelope {
  error: McpErrorEnvelope;
  durationMs: number;
}

export interface ToolInvokeContext {
  requestId: string;
  service: string;
  c: Context;
}

// Bivariance hack: TypeScript enforces contravariance on function parameters,
// which prevents McpToolDefinition<TIn, TOut> from being assignable to
// McpAnyToolDefinition (McpToolDefinition<unknown, unknown>).
// Wrapping the handler as a method property disables strict function type checking,
// making generic tool definitions usable in registry arrays.
type BivariantHandler<TInput, TOutput> = {
  bivarianceHack: (input: TInput, context: ToolInvokeContext) => Promise<TOutput>;
}['bivarianceHack'];

export interface McpToolDefinition<TInput, TOutput> {
  name: string;
  description: string;
  inputSchema: z.ZodType<TInput, z.ZodTypeDef, unknown>;
  outputSchema: z.ZodType<TOutput, z.ZodTypeDef, unknown>;
  handler: BivariantHandler<TInput, TOutput>;
}

export type McpAnyToolDefinition = McpToolDefinition<unknown, unknown>;

export interface McpToolManifestEntry {
  name: string;
  description: string;
  inputSchema: unknown;
  outputSchema: unknown;
}

export interface McpServerOptions {
  serviceName: string;
  tools: ReadonlyArray<McpAnyToolDefinition>;
}
