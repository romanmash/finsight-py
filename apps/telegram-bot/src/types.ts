import type { TelegramConfig } from '../../../config/types/telegram.schema.js';

export type BotCommandName =
  | 'help'
  | 'brief'
  | 'pattern'
  | 'compare'
  | 'devil'
  | 'thesis'
  | 'history'
  | 'screener_show_last'
  | 'trade'
  | 'approve'
  | 'reject'
  | 'alert'
  | 'ack'
  | 'watchlist'
  | 'add'
  | 'portfolio';

export interface TelegramPrincipal {
  userId: string;
  role: 'admin' | 'analyst' | 'viewer';
  telegramHandle: string;
  active: boolean;
  telegramChatId: bigint | null;
}

export interface IncomingTelegramMessage {
  text: string;
  messageId: number;
  fromId?: number;
  username?: string;
  chatId?: number;
}

export interface ParsedCommand {
  command: BotCommandName;
  args: string[];
  originalText: string;
}

export type TelegramConfigView = TelegramConfig;

export interface CommandUsageError {
  code: 'validation_error';
  message: string;
}

export interface ParsedEnvelope {
  parsedCommand: ParsedCommand | null;
  freeText: string | null;
}

export interface CommandResult {
  label: string;
  body: string;
}
