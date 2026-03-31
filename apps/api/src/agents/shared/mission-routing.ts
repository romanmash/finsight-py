import { MissionType } from '@finsight/shared-types';

export interface MissionPipeline {
  steps: string[];
}

const PIPELINES: Record<string, MissionPipeline> = {
  [MissionType.OPERATOR_QUERY]: { steps: ['kb_fast_path', 'researcher', 'analyst', 'bookkeeper', 'reporter'] },
  [MissionType.ALERT_INVESTIGATION]: { steps: ['researcher', 'analyst', 'technician_optional', 'bookkeeper', 'reporter'] },
  [MissionType.COMPARISON]: { steps: ['researcher_parallel', 'analyst_comparison', 'bookkeeper', 'reporter'] },
  [MissionType.DEVIL_ADVOCATE]: { steps: ['researcher', 'analyst_devil_advocate', 'bookkeeper', 'reporter'] },
  [MissionType.PATTERN_REQUEST]: { steps: ['technician', 'reporter'] },
  [MissionType.EARNINGS_PREBRIEF]: { steps: ['researcher', 'analyst', 'bookkeeper', 'reporter'] },
  [MissionType.TRADE_REQUEST]: { steps: ['researcher', 'analyst', 'bookkeeper', 'trader', 'reporter'] },
  [MissionType.DAILY_BRIEF]: { steps: ['researcher_parallel', 'analyst_parallel', 'bookkeeper_parallel', 'reporter'] }
};

export function resolveMissionPipeline(missionType: string): MissionPipeline {
  const pipeline = PIPELINES[missionType];
  if (pipeline === undefined) {
    return PIPELINES[MissionType.OPERATOR_QUERY]!;
  }

  return pipeline;
}
