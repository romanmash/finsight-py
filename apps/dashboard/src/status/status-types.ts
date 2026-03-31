export type AgentState = 'active' | 'queued' | 'idle' | 'error';
export type HealthState = 'ok' | 'degraded' | 'error' | 'unknown';
export type ActionFeedbackClass = 'success' | 'retriable_error' | 'terminal_error';

export interface AgentStatus {
  state: AgentState;
  currentTask: string | null;
  currentMissionId: string | null;
  model: string | null;
  provider: string | null;
  todayTokensIn: number;
  todayTokensOut: number;
  todayCostUsd: number;
  lastActiveAt: string | null;
  errorMessage: string | null;
}

export interface MissionPipelineTool {
  name: string;
  status: 'running' | 'done' | 'pending' | 'error';
}

export interface MissionPipelineStep {
  agent: string;
  status: 'running' | 'done' | 'pending' | 'error';
  tools?: MissionPipelineTool[];
}

export interface MissionActive {
  id: string;
  type: string;
  status: string;
  tickers: string[];
  trigger: string;
  createdAt: string;
  pipeline?: MissionPipelineStep[];
}

export interface MissionRecent {
  id: string;
  type: string;
  status: string;
  tickers: string[];
  createdAt: string;
  completedAt: string | null;
  traceUrl?: string;
}

export interface ServiceHealth {
  status: HealthState;
  message: string | null;
  checkedAt: string;
}

export interface AdminStatusSnapshot {
  generatedAt: string;
  degraded: boolean;
  agents: Record<string, AgentStatus>;
  spend: {
    todayTotalUsd: number;
    byProvider: Record<string, number>;
  };
  mission: {
    active: MissionActive | null;
    recent: MissionRecent[];
  };
  health: {
    postgres: ServiceHealth;
    redis: ServiceHealth;
    mcpServers: Record<string, ServiceHealth>;
    lmStudio: ServiceHealth;
    telegramBot: ServiceHealth;
  };
  kb: {
    totalEntries: number;
    contradictionCount: number;
    lastWriteAt: string | null;
    tickersTracked: number;
  };
  queues: {
    depths: Record<string, number>;
    pendingAlerts: number;
    pendingTickets: number;
  };
  errors: Array<{ section: string; message: string }>;
}

export interface ActionFeedback {
  kind: ActionFeedbackClass;
  message: string;
  details?: string;
  at: string;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  telegramHandle: string | null;
  active: boolean;
}
