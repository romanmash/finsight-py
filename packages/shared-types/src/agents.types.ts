/** Supported FinSight agent names. */
export const AgentName = {
  MANAGER: 'manager',
  WATCHDOG: 'watchdog',
  SCREENER: 'screener',
  RESEARCHER: 'researcher',
  ANALYST: 'analyst',
  TECHNICIAN: 'technician',
  BOOKKEEPER: 'bookkeeper',
  REPORTER: 'reporter',
  TRADER: 'trader'
} as const;

export type AgentName = (typeof AgentName)[keyof typeof AgentName];

/** Current runtime state of an agent card. */
export const AgentState = {
  ACTIVE: 'active',
  QUEUED: 'queued',
  IDLE: 'idle',
  ERROR: 'error'
} as const;

export type AgentState = (typeof AgentState)[keyof typeof AgentState];

/** LLM providers supported by the runtime router. */
export const Provider = {
  ANTHROPIC: 'anthropic',
  OPENAI: 'openai',
  AZURE: 'azure',
  LMSTUDIO: 'lmstudio'
} as const;

export type Provider = (typeof Provider)[keyof typeof Provider];

/** Confidence labels used across outputs and tickets. */
export const Confidence = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
} as const;

export type Confidence = (typeof Confidence)[keyof typeof Confidence];

/** Analyst execution modes. */
export const AnalystMode = {
  STANDARD: 'standard',
  DEVIL_ADVOCATE: 'devil_advocate',
  COMPARISON: 'comparison'
} as const;

export type AnalystMode = (typeof AnalystMode)[keyof typeof AnalystMode];

/** Provider/model settings used by one agent role. */
export interface AgentModelConfig {
  provider: Provider;
  model: string;
  temperature: number;
  maxTokens: number;
}

/** Full model policy for an agent including optional fallback. */
export interface AgentConfig {
  primary: AgentModelConfig;
  fallback?: AgentModelConfig;
  devilAdvocateTemperature?: number;
}

/** Thin representation of a prior KB entry used in prompts. */
export interface KbEntrySnippet {
  id: string;
  content: string;
  ticker: string | null;
  entryType: string;
  similarityScore: number;
  contradictionFlag: boolean;
}

/** Canonical output from the Researcher agent. */
export interface ResearchOutput {
  ticker: string;
  focusQuestions: string[];
  ohlcvSummary: {
    recentTrend: string;
    keyPricePoints: Record<string, number>;
  };
  fundamentals: Record<string, unknown>;
  analystRatings: {
    consensus: string;
    avgTarget: number;
    breakdown: Record<string, number>;
  } | null;
  newsItems: Array<{
    headline: string;
    sentiment: string;
    datetime: number;
  }>;
  sentimentSummary: {
    avgScore: number;
    trend: string;
  };
  gdeltRiskScore: number;
  existingKbContext: KbEntrySnippet[];
  internalDocs: Array<{
    title: string;
    snippet: string;
  }>;
  confidence: Confidence;
  confidenceReason: string;
}

/** Canonical output from the Analyst agent. */
export interface AnalystOutput {
  ticker: string | string[];
  mode: AnalystMode;
  thesisUpdate: string;
  supportingEvidence: string[];
  riskFactors: string[];
  contradictions: string[];
  sentimentDelta: 'improved' | 'deteriorated' | 'unchanged';
  comparisonTable?: Record<string, unknown>;
  confidence: Confidence;
  confidenceReason: string;
}

/** Canonical output from the Technician agent. */
export interface TechnicianOutput {
  ticker: string;
  periodWeeks: number;
  trend: 'bullish' | 'bearish' | 'neutral' | 'mixed';
  keyLevels: {
    support: number;
    resistance: number;
  };
  indicators: {
    rsi: {
      value: number;
      signal: 'overbought' | 'oversold' | 'neutral';
    };
    macd: {
      signal: 'bullish_crossover' | 'bearish_crossover' | 'neutral';
    };
    bollingerPosition: 'upper' | 'middle' | 'lower' | 'outside_upper' | 'outside_lower';
    volumeSpike: boolean;
  };
  patterns: string[];
  summary: string;
  confidence: Confidence;
  confidenceReason: string;
}

/** Payload sent to Bookkeeper before KB persistence. */
export interface BookkeeperInput {
  analystOutput: AnalystOutput;
  technicianOutput?: TechnicianOutput;
  missionId: string;
  userId: string;
}
