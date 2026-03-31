import { z } from 'zod';
import { MissionType } from '@finsight/shared-types';

export const missionTypeSchema = z.nativeEnum(MissionType);
export type MissionTypeValue = z.infer<typeof missionTypeSchema>;

export const missionTriggerSchema = z.enum(['user', 'scheduled', 'alert']);
export type MissionTriggerValue = z.infer<typeof missionTriggerSchema>;

export const managerInputSchema = z.object({
  missionId: z.string().min(1).optional(),
  userId: z.string().min(1).optional(),
  message: z.string().min(1).optional(),
  ticker: z.string().min(1).optional(),
  tickers: z.array(z.string().min(1)).optional(),
  triggerType: missionTriggerSchema.default('user'),
  missionType: missionTypeSchema.optional(),
  context: z.record(z.string(), z.unknown()).optional()
}).strict();
export type ManagerInput = z.infer<typeof managerInputSchema>;

export const orchestrationDecisionSchema = z.object({
  missionType: missionTypeSchema,
  pipelineSteps: z.array(z.string().min(1)).min(1),
  fastPathEligible: z.boolean(),
  reDispatchAllowed: z.boolean()
}).strict();
export type OrchestrationDecision = z.infer<typeof orchestrationDecisionSchema>;

export const managerOutputSchema = z.object({
  missionId: z.string().min(1),
  missionType: missionTypeSchema,
  response: z.string().min(1),
  trigger: z.enum(['pipeline', 'kb_fast_path']),
  stepsExecuted: z.array(z.string().min(1)),
  traceUrl: z.string().min(1).optional()
}).strict();
export type ManagerOutput = z.infer<typeof managerOutputSchema>;

export interface FastPathCandidate {
  id: string;
  content: string;
  updatedAt: Date;
  confidence: 'low' | 'medium' | 'high';
}

export interface FastPathResolution {
  hit: boolean;
  reason: 'not_operator_query' | 'missing_ticker' | 'missing_entry' | 'stale' | 'insufficient_confidence' | 'eligible';
  entry: FastPathCandidate | null;
}
