import { getConfig } from '../lib/config.js';
import { getMcpToolRegistry } from '../mcp/index.js';
import type { ResearchCollectionOutput } from '../types/collectors.js';
import { researchCollectionOutputSchema } from '../types/collectors.js';
import { createRecoverableFailure, setCollectorActive, setCollectorError, setCollectorIdle } from './shared/collector-state.js';

interface ToolInvoker {
  invoke: (input: unknown) => Promise<{ output?: unknown; error?: { message: string } }>;
}

interface ResearcherDependencies {
  getTool: (name: string) => ToolInvoker | null;
  getRuntimeConfig: () => ReturnType<typeof getConfig>;
  setActiveState: () => Promise<void>;
  setIdleState: (summary: string) => Promise<void>;
  setErrorState: (message: string) => Promise<void>;
}

const MISSION_TYPES = ['operator_query', 'alert_investigation', 'comparison', 'devil_advocate', 'earnings_prebrief'] as const;

type MissionType = (typeof MISSION_TYPES)[number];

function defaultDependencies(): ResearcherDependencies {
  const registry = getMcpToolRegistry();
  return {
    getTool: (name: string) => (registry.all[name] as ToolInvoker | undefined) ?? null,
    getRuntimeConfig: () => getConfig(),
    setActiveState: () => setCollectorActive('researcher', 'mission-collection', undefined),
    setIdleState: (summary: string) => setCollectorIdle('researcher', summary),
    setErrorState: (message: string) => setCollectorError('researcher', message)
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  return value as Record<string, unknown>;
}

function parseMissionType(input?: string): MissionType {
  if (input === undefined) {
    return 'operator_query';
  }

  if ((MISSION_TYPES as readonly string[]).includes(input)) {
    return input as MissionType;
  }

  throw createRecoverableFailure('VALIDATION_ERROR', 'unsupported mission type', {
    missionType: input
  });
}

async function invokeToolSafe(tool: ToolInvoker | null, input: unknown): Promise<Record<string, unknown> | null> {
  if (tool === null) {
    return null;
  }

  const result = await tool.invoke(input);
  if (result.error !== undefined) {
    return null;
  }

  return asRecord(result.output);
}

export async function runResearcher(
  input: { ticker: string; focusQuestions: string[]; missionType?: string },
  deps: ResearcherDependencies = defaultDependencies()
): Promise<ResearchCollectionOutput> {
  const ticker = input.ticker.toUpperCase();
  const missionType = parseMissionType(input.missionType);
  const focusQuestions = input.focusQuestions.map((question) => question.trim()).filter((question) => question.length > 0);

  await deps.setActiveState();

  try {
    const config = deps.getRuntimeConfig();
    const maxSteps = config.app.collector.researcherMaxToolSteps;

    const factsTool = deps.getTool('get_multiple_quotes');
    const fundamentalsTool = deps.getTool('get_company_fundamentals');
    const newsTool = deps.getTool('get_ticker_news');
    const kbTool = deps.getTool('rag_retrieve');

    const collectedFacts: Array<Record<string, unknown>> = [];
    const gaps: string[] = [];

    const quotePayload = await invokeToolSafe(factsTool, { tickers: [ticker] });
    if (quotePayload === null) {
      gaps.push('quotes_unavailable');
    } else {
      collectedFacts.push({ source: 'quotes', payload: quotePayload });
    }

    const fundamentalsPayload = await invokeToolSafe(fundamentalsTool, { ticker });
    if (fundamentalsPayload === null) {
      gaps.push('fundamentals_unavailable');
    }

    const newsPayload = await invokeToolSafe(newsTool, { ticker, limit: Math.min(10, maxSteps) });
    if (newsPayload === null) {
      gaps.push('news_unavailable');
    }

    const kbPayload = await invokeToolSafe(kbTool, {
      query: `${ticker} ${focusQuestions.join(' ')}`.trim(),
      limit: Math.min(5, maxSteps)
    });

    const output: ResearchCollectionOutput = {
      ticker,
      focusQuestions,
      missionType,
      collectedFacts,
      newsSummary: newsPayload ?? {},
      fundamentalsSummary: fundamentalsPayload ?? {},
      kbContext: Array.isArray(kbPayload?.items) ? (kbPayload.items as Array<Record<string, unknown>>) : [],
      confidence: gaps.length === 0 ? 'high' : gaps.length <= 2 ? 'medium' : 'low',
      gaps
    };

    const validated = researchCollectionOutputSchema.safeParse(output);
    if (!validated.success) {
      throw createRecoverableFailure('MALFORMED_OUTPUT', 'researcher output validation failed', {
        issue: validated.error.issues[0]?.message
      });
    }

    await deps.setIdleState(`ticker=${ticker} gaps=${String(gaps.length)}`);
    return validated.data;
  } catch (error) {
    await deps.setErrorState((error as Error).message);
    if (typeof error === 'object' && error !== null && 'recoverable' in error) {
      throw error;
    }

    throw createRecoverableFailure('UPSTREAM_UNAVAILABLE', 'researcher run failed', {
      errorMessage: (error as Error).message
    });
  }
}
