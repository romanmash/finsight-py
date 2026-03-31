import type { BotCommandName, CommandResult } from './types.js';

const MISSION_LABELS: Record<string, string> = {
  operator_query: '📊 Analysis',
  alert_investigation: '🚨 Alert Investigation',
  comparison: '⚖️ Comparison',
  devil_advocate: '🧪 Devil\'s Advocate',
  pattern_request: '📈 Pattern',
  earnings_prebrief: '🗓️ Earnings Prebrief',
  trade_request: '🧾 Trade Ticket',
  daily_brief: '📰 Daily Brief'
};

const COMMAND_LABELS: Record<BotCommandName, string> = {
  help: '🧭 Help',
  brief: '📰 Brief',
  pattern: '📈 Pattern',
  compare: '⚖️ Compare',
  devil: '🧪 Devil\'s Advocate',
  thesis: '🧠 Thesis',
  history: '🕰️ Thesis History',
  screener_show_last: '🧮 Screener',
  trade: '🧾 Trade',
  approve: '✅ Ticket',
  reject: '⛔ Ticket',
  alert: '🚨 Alerts',
  ack: '✅ Alert',
  watchlist: '👀 Watchlist',
  add: '➕ Watchlist',
  portfolio: '💼 Portfolio'
};

export function formatResult(label: string, body: string): string {
  return `${label}\n\n${body}`;
}

export function labelForCommand(command: BotCommandName): string {
  return COMMAND_LABELS[command];
}

export function labelForMission(missionType: string | undefined): string {
  if (missionType === undefined) {
    return '📌 Mission Output';
  }

  return MISSION_LABELS[missionType] ?? '📌 Mission Output';
}

export function splitMessage(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > maxLength) {
    const slice = remaining.slice(0, maxLength);
    const boundary = Math.max(slice.lastIndexOf('\n'), slice.lastIndexOf(' '));
    const cut = boundary > 0 ? boundary : maxLength;
    chunks.push(remaining.slice(0, cut).trimEnd());
    remaining = remaining.slice(cut).trimStart();
  }

  if (remaining.length > 0) {
    chunks.push(remaining);
  }

  return chunks;
}

export function asCommandResult(label: string, body: string): CommandResult {
  return { label, body };
}
