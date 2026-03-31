import { db } from '../lib/db.js';
import { ensureProviderPolicyResolved } from './shared/provider-policy.js';
import { extractConfidenceFromMetadata } from './shared/thesis-context.js';
import type { AnalystOutput, BookkeeperOutput, ContradictionSeverity, KbChangeType, RunBookkeeperInput } from '../types/reasoning.js';
import {
  bookkeeperOutputSchema,
  KB_EMBEDDING_VECTOR_LENGTH,
  runBookkeeperInputSchema
} from '../types/reasoning.js';

interface PriorThesis {
  kbEntryId: string;
  content: string;
  confidence: 'low' | 'medium' | 'high';
}

interface BookkeeperDependencies {
  getPriorThesis: (ticker: string) => Promise<PriorThesis | null>;
  assessContradiction: (prior: PriorThesis | null, nextOutput: AnalystOutput) => Promise<ContradictionSeverity>;
  generateEmbedding: (content: string) => Promise<number[]>;
  persist: (input: {
    parsed: RunBookkeeperInput;
    prior: PriorThesis | null;
    contradictionSeverity: ContradictionSeverity;
    embedding: number[];
    changeType: KbChangeType;
  }) => Promise<{ kbEntryId: string; snapshotCreated: boolean }>;
}

function confidenceFromAnalyst(output: AnalystOutput): 'low' | 'medium' | 'high' {
  return output.confidence;
}

function deriveChangeType(input: RunBookkeeperInput, prior: PriorThesis | null, contradictionSeverity: ContradictionSeverity): KbChangeType {
  if (prior === null) {
    return 'initial';
  }

  if (input.analystOutput.mode === 'devil_advocate') {
    return 'devil_advocate';
  }

  if (contradictionSeverity === 'high') {
    return 'contradiction';
  }

  return 'update';
}

function toVectorLiteral(embedding: number[]): string {
  const normalized = embedding.map((value) => {
    if (!Number.isFinite(value)) {
      throw new Error('embedding contains non-finite value');
    }

    return value.toString();
  });

  return `[${normalized.join(',')}]`;
}

function defaultDependencies(): BookkeeperDependencies {
  return {
    getPriorThesis: async (ticker: string): Promise<PriorThesis | null> => {
      const entry = await db.kbEntry.findFirst({
        where: { ticker },
        orderBy: { updatedAt: 'desc' }
      });

      if (entry === null) {
        return null;
      }

      const confidence = extractConfidenceFromMetadata(entry.metadata);

      return {
        kbEntryId: entry.id,
        content: entry.content,
        confidence
      };
    },
    assessContradiction: async (prior: PriorThesis | null, nextOutput: AnalystOutput): Promise<ContradictionSeverity> => {
      if (prior === null) {
        return 'none';
      }

      const normalizedPrior = prior.content.trim().toLowerCase();
      const normalizedNext = nextOutput.thesisUpdate.trim().toLowerCase();

      if (normalizedPrior.length > 0 && normalizedPrior !== normalizedNext) {
        return 'high';
      }

      return 'none';
    },
    generateEmbedding: async (): Promise<number[]> => {
      throw new Error('Bookkeeper embedding provider is not wired. Inject generateEmbedding dependency.');
    },
    persist: async ({ parsed, prior, contradictionSeverity, embedding, changeType }): Promise<{ kbEntryId: string; snapshotCreated: boolean }> => {
      const ticker = Array.isArray(parsed.analystOutput.ticker) ? parsed.analystOutput.ticker[0] : parsed.analystOutput.ticker;
      if (ticker === undefined) {
        throw new Error('bookkeeper requires ticker in analyst output');
      }

      const vectorLiteral = toVectorLiteral(embedding);

      const created = await db.$transaction(async (tx) => {
        let snapshotCreated = false;

        if (prior !== null) {
          await tx.kbThesisSnapshot.create({
            data: {
              ticker,
              thesis: prior.content,
              confidence: prior.confidence,
              changeType,
              missionId: parsed.missionId,
              changeSummary: 'pre-overwrite snapshot'
            }
          });
          snapshotCreated = true;
        }

        const kbEntry = await tx.kbEntry.create({
          data: {
            ticker,
            entryType: 'thesis',
            content: parsed.analystOutput.thesisUpdate,
            contradictionFlag: contradictionSeverity === 'high',
            contradictionNote: contradictionSeverity === 'high' ? 'high severity contradiction detected' : null,
            missionId: parsed.missionId,
            metadata: {
              confidence: confidenceFromAnalyst(parsed.analystOutput),
              changeType,
              contradictionSeverity,
              embeddingLength: embedding.length
            }
          }
        });

        await tx.$executeRaw`UPDATE "KbEntry" SET embedding = ${vectorLiteral}::vector WHERE id = ${kbEntry.id}`;

        if (contradictionSeverity === 'high') {
          await tx.alert.create({
            data: {
              userId: parsed.userId,
              ticker,
              alertType: 'thesis_contradiction',
              severity: 'high',
              message: `Contradiction detected for ${ticker}`,
              missionId: parsed.missionId
            }
          });
        }

        await tx.mission.update({
          where: { id: parsed.missionId },
          data: { status: 'complete' }
        });

        return {
          kbEntryId: kbEntry.id,
          snapshotCreated
        };
      });

      return created;
    }
  };
}

export async function runBookkeeper(
  input: RunBookkeeperInput,
  deps: BookkeeperDependencies = defaultDependencies()
): Promise<BookkeeperOutput> {
  const parsed = runBookkeeperInputSchema.parse(input);
  ensureProviderPolicyResolved('bookkeeper');
  const ticker = Array.isArray(parsed.analystOutput.ticker) ? parsed.analystOutput.ticker[0] : parsed.analystOutput.ticker;

  if (ticker === undefined) {
    throw new Error('bookkeeper requires ticker in analyst output');
  }

  const prior = await deps.getPriorThesis(ticker);
  const contradictionSeverity = await deps.assessContradiction(prior, parsed.analystOutput);
  const changeType = deriveChangeType(parsed, prior, contradictionSeverity);

  const embedding = await deps.generateEmbedding(parsed.analystOutput.thesisUpdate);
  if (embedding.length !== KB_EMBEDDING_VECTOR_LENGTH) {
    throw new Error(`embedding length must be ${String(KB_EMBEDDING_VECTOR_LENGTH)}`);
  }

  const persisted = await deps.persist({
    parsed,
    prior,
    contradictionSeverity,
    embedding,
    changeType
  });

  return bookkeeperOutputSchema.parse({
    kbEntryId: persisted.kbEntryId,
    changeType,
    contradictionSeverity,
    snapshotCreated: persisted.snapshotCreated
  });
}
