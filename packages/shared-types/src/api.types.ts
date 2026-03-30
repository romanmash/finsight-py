import type { AgentName, AgentState } from './agents.types.js';
import type { MissionStatus, MissionType } from './missions.types.js';

/** Admin dashboard status polling response. */
export interface AdminStatusResponse {
  system: {
    status: 'ok' | 'degraded' | 'error';
    uptimeSec: number;
  };
  agents: Record<AgentName, {
    state: AgentState;
    currentTask: string | null;
    currentMissionId: string | null;
  }>;
  todaysCostUsd: number;
}

/** Telegram/API chat request response. */
export interface ChatResponse {
  missionId: string;
  response: string;
}

/** Mission detail payload used by admin views. */
export interface MissionResponse {
  mission: {
    id: string;
    type: MissionType;
    status: MissionStatus;
    createdAt: string;
    updatedAt: string;
  };
  runs: Array<{
    id: string;
    agent: AgentName;
    status: MissionStatus;
    startedAt: string;
    endedAt: string | null;
  }>;
}
