import type { BotCommandName, CommandUsageError, ParsedCommand, ParsedEnvelope } from './types.js';

interface CommandSpec {
  command: Exclude<BotCommandName, 'screener_show_last'>;
  minArgs: number;
  maxArgs: number;
}

const SIMPLE_COMMANDS: Record<string, CommandSpec> = {
  help: { command: 'help', minArgs: 0, maxArgs: 0 },
  brief: { command: 'brief', minArgs: 0, maxArgs: 0 },
  pattern: { command: 'pattern', minArgs: 2, maxArgs: 2 },
  compare: { command: 'compare', minArgs: 2, maxArgs: 2 },
  devil: { command: 'devil', minArgs: 1, maxArgs: 1 },
  thesis: { command: 'thesis', minArgs: 1, maxArgs: 1 },
  history: { command: 'history', minArgs: 1, maxArgs: 1 },
  trade: { command: 'trade', minArgs: 3, maxArgs: 3 },
  approve: { command: 'approve', minArgs: 1, maxArgs: 1 },
  reject: { command: 'reject', minArgs: 1, maxArgs: Number.MAX_SAFE_INTEGER },
  alert: { command: 'alert', minArgs: 0, maxArgs: 0 },
  ack: { command: 'ack', minArgs: 1, maxArgs: 1 },
  watchlist: { command: 'watchlist', minArgs: 0, maxArgs: 0 },
  add: { command: 'add', minArgs: 2, maxArgs: 2 },
  portfolio: { command: 'portfolio', minArgs: 0, maxArgs: 0 }
};

function toUsageError(message = 'Invalid command usage'): CommandUsageError {
  return { code: 'validation_error', message };
}

export function parseEnvelope(text: string): ParsedEnvelope {
  const trimmed = text.trim();
  if (!trimmed.startsWith('/')) {
    return { parsedCommand: null, freeText: trimmed.length > 0 ? trimmed : null };
  }

  const tokens = trimmed.slice(1).split(/\s+/);
  const base = tokens[0]?.toLowerCase();
  const args = tokens.slice(1);

  if (base === 'screener' && args.length === 2 && args[0]?.toLowerCase() === 'show' && args[1]?.toLowerCase() === 'last') {
    return {
      parsedCommand: {
        command: 'screener_show_last',
        args,
        originalText: trimmed
      },
      freeText: null
    };
  }

  if (base === undefined || !(base in SIMPLE_COMMANDS)) {
    return { parsedCommand: null, freeText: null };
  }

  const spec = SIMPLE_COMMANDS[base];
  if (spec === undefined) {
    return { parsedCommand: null, freeText: null };
  }

  const parsedCommand: ParsedCommand = {
    command: spec.command,
    args,
    originalText: trimmed
  };

  return { parsedCommand, freeText: null };
}

export function validateParsedCommand(parsed: ParsedCommand): CommandUsageError | null {
  if (parsed.command === 'screener_show_last') {
    return null;
  }

  const spec = SIMPLE_COMMANDS[parsed.command];
  if (spec === undefined) {
    return toUsageError();
  }

  if (parsed.args.length < spec.minArgs || parsed.args.length > spec.maxArgs) {
    return toUsageError();
  }

  if (parsed.command === 'trade') {
    const action = parsed.args[1]?.toLowerCase();
    const quantity = Number(parsed.args[2]);
    if ((action !== 'buy' && action !== 'sell') || !Number.isFinite(quantity) || quantity <= 0) {
      return toUsageError();
    }
  }

  return null;
}
