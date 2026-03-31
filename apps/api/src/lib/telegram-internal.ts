import { z } from 'zod';

const payloadSchema = z.object({
  userId: z.string().min(1),
  message: z.string().min(1),
  sourceType: z.enum(['alert', 'daily_brief', 'system']),
  missionId: z.string().min(1).optional(),
  correlationId: z.string().min(1).optional()
}).strict();

export type TelegramInternalPushPayload = z.infer<typeof payloadSchema>;

export interface TelegramInternalPushResult {
  delivered: boolean;
  reason: 'sent' | 'skipped_no_chat' | 'send_failed' | 'duplicate';
}

function getPushUrl(): string {
  return process.env.TELEGRAM_BOT_INTERNAL_PUSH_URL ?? 'http://telegram-bot:3000/internal/push';
}

function getToken(): string {
  const token = process.env.TELEGRAM_INTERNAL_TOKEN;
  if (token === undefined || token.trim().length === 0) {
    throw new Error('TELEGRAM_INTERNAL_TOKEN is required for internal push');
  }

  return token.trim();
}

export async function dispatchTelegramInternalPush(payload: TelegramInternalPushPayload): Promise<TelegramInternalPushResult> {
  payloadSchema.parse(payload);

  const response = await fetch(getPushUrl(), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-internal-token': getToken()
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`telegram internal push failed (${response.status})`);
  }

  const data = await response.json() as TelegramInternalPushResult;
  return data;
}
