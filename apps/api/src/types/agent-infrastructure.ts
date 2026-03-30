import type { AgentsConfig, McpConfig } from '../../../../config/types/index.js';

export type AgentName = Exclude<keyof AgentsConfig, 'confidence'>;
export type ProviderName = 'anthropic' | 'openai' | 'azure' | 'lmstudio';

export interface McpServerDefinition {
  name: keyof McpConfig['servers'];
  url: string;
  timeoutMs: number;
  required: boolean;
}

export interface ToolManifestEntry {
  name: string;
  description?: string;
  inputSchemaDescriptor: Record<string, unknown>;
  outputSchemaDescriptor: Record<string, unknown>;
  sourceServer: string;
}

export type ToolInvocationErrorCode = 'UPSTREAM_ERROR' | 'TIMEOUT' | 'VALIDATION_ERROR' | 'UNAVAILABLE';

export interface ToolInvocationError {
  code: ToolInvocationErrorCode;
  message: string;
  sourceServer: string;
  retryable: boolean;
}

export interface ToolInvocationSuccessEnvelope {
  output: unknown;
  durationMs: number;
}

export interface ToolInvocationFailureEnvelope {
  error: ToolInvocationError;
  durationMs: number;
}

export type ToolInvocationResultEnvelope = ToolInvocationSuccessEnvelope | ToolInvocationFailureEnvelope;

export interface McpToolBinding {
  name: string;
  sourceServer: string;
  description?: string;
  invoke: (input: unknown) => Promise<ToolInvocationResultEnvelope>;
}

export interface AgentToolRegistry {
  byServer: Record<string, Record<string, McpToolBinding>>;
  all: Record<string, McpToolBinding>;
  initializedAt: string;
}

export interface ProviderResolutionPolicy {
  agentName: AgentName;
  primary: AgentsConfig[AgentName]['primary'];
  fallback?: AgentsConfig[AgentName]['fallback'];
}

export interface GenerationOverrides {
  temperature?: number;
  maxTokens?: number;
}

export interface ResolvedProviderProfile {
  provider: ProviderName;
  model: string;
  effectiveTemperature: number;
  effectiveMaxTokens: number;
  resolutionPath: 'primary' | 'fallback';
}

export interface LocalProviderHealthState {
  available: boolean;
  checkedAt: string;
  staleAfterMs: number;
  reason?: string;
  modelCount?: number;
}

export interface ToolInvocationRequest {
  tool: string;
  input: unknown;
}


