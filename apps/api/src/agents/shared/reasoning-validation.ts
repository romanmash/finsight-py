import { ZodSchema } from 'zod';

export class ReasoningValidationError extends Error {
  readonly code: 'MALFORMED_OUTPUT';
  readonly attemptCount: number;

  constructor(message: string, attemptCount: number) {
    super(message);
    this.code = 'MALFORMED_OUTPUT';
    this.attemptCount = attemptCount;
  }
}

export async function validateWithSingleRetry<T>(
  producer: () => Promise<unknown>,
  schema: ZodSchema<T>
): Promise<T> {
  let attempts = 0;
  let lastErrorMessage = 'unknown validation error';

  while (attempts < 2) {
    attempts += 1;
    const candidate = await producer();
    const parsed = schema.safeParse(candidate);
    if (parsed.success) {
      return parsed.data;
    }

    lastErrorMessage = parsed.error.issues[0]?.message ?? 'schema validation failed';
  }

  throw new ReasoningValidationError(lastErrorMessage, attempts);
}

export function splitIntoTelegramChunks(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const next = Math.min(start + maxLength, text.length);
    chunks.push(text.slice(start, next));
    start = next;
  }

  return chunks;
}

export function countSentences(text: string): number {
  const normalized = text.trim();
  if (normalized.length === 0) {
    return 0;
  }

  const parts = normalized
    .split(/(?<=[.!?])\s+/u)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  return parts.length;
}
