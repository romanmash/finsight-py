import type { ApiClient } from './api-client.js';
import { parseEnvelope, validateParsedCommand } from './commands.js';
import { asCommandResult, formatResult, labelForCommand, labelForMission, splitMessage } from './formatter.js';
import { botLogger } from './logger.js';
import type { IdentityResolver } from './auth.js';
import type { RateLimiter } from './rate-limit.js';
import type { IncomingTelegramMessage, TelegramConfigView } from './types.js';
import type { UserChatLinkStore } from './user-chat-link.js';

interface HandlerDependencies {
  config: TelegramConfigView;
  auth: IdentityResolver;
  rateLimiter: RateLimiter;
  apiClientForUser: (userId: string) => ApiClient;
  userChatLinkStore: UserChatLinkStore;
}

export async function handleIncomingMessage(
  incoming: IncomingTelegramMessage,
  deps: HandlerDependencies
): Promise<{ chunks: string[] }> {
  if (incoming.fromId === undefined || incoming.chatId === undefined || incoming.username === undefined) {
    return {
      chunks: [deps.config.responseMessages.validationError]
    };
  }

  const principal = await deps.auth.resolveByUsername(incoming.username);
  if (principal === null || !principal.active) {
    botLogger.warn({
      eventType: 'telegram_auth_denied',
      telegramHandle: incoming.username,
      chatId: incoming.chatId,
      reasonCode: 'unauthorized'
    }, 'Unauthorized telegram sender denied');

    return {
      chunks: [deps.config.responseMessages.unauthorized]
    };
  }

  const allowed = await deps.rateLimiter.consume(principal.userId);
  if (!allowed) {
    botLogger.warn({
      eventType: 'telegram_rate_limited',
      userId: principal.userId,
      telegramHandle: incoming.username,
      chatId: incoming.chatId,
      reasonCode: 'throttled'
    }, 'User throttled');

    return {
      chunks: [deps.config.responseMessages.throttled]
    };
  }

  const envelope = parseEnvelope(incoming.text);
  const apiClient = deps.apiClientForUser(principal.userId);

  try {
    let formatted: string;

    if (envelope.parsedCommand !== null) {
      const enabled = deps.config.commandBehavior.enabledCommands[envelope.parsedCommand.command] ?? false;
      if (!enabled) {
        return { chunks: [deps.config.responseMessages.validationError] };
      }

      const usageError = validateParsedCommand(envelope.parsedCommand);
      if (usageError !== null) {
        return { chunks: [deps.config.responseMessages.validationError] };
      }

      const command = envelope.parsedCommand;
      let result = asCommandResult(labelForCommand(command.command), 'Done.');

      switch (command.command) {
        case 'help':
          result = asCommandResult(labelForCommand(command.command), '/help /brief /pattern /compare /devil /thesis /history /screener show last /trade /approve /reject /alert /ack /watchlist /add /portfolio');
          break;
        case 'brief': {
          const brief = await apiClient.latestBrief();
          result = asCommandResult(labelForCommand(command.command), brief.brief?.rawText ?? 'No brief available.');
          break;
        }
        case 'pattern':
        case 'compare':
        case 'devil':
        case 'trade': {
          const response = await apiClient.chat(command.originalText);
          result = asCommandResult(labelForMission(response.missionType), response.response);
          break;
        }
        case 'thesis': {
          const thesis = await apiClient.thesis(command.args[0] ?? '');
          result = asCommandResult(labelForCommand(command.command), thesis.thesis?.content ?? 'No thesis available.');
          break;
        }
        case 'history': {
          const history = await apiClient.history(command.args[0] ?? '');
          const lines = history.history.map((entry) => `${entry.createdAt}: ${entry.changeSummary ?? entry.thesis}`);
          result = asCommandResult(labelForCommand(command.command), lines.length > 0 ? lines.join('\n') : 'No history available.');
          break;
        }
        case 'screener_show_last': {
          const summary = await apiClient.screenerSummary();
          result = asCommandResult(labelForCommand(command.command), summary.summary === null ? 'No screener run found.' : JSON.stringify(summary.summary));
          break;
        }
        case 'approve': {
          const approved = await apiClient.approveTicket(command.args[0] ?? '');
          result = asCommandResult(labelForCommand(command.command), approved.approved ? 'Ticket approved.' : 'Ticket not approved.');
          break;
        }
        case 'reject': {
          const [ticketId, ...reasonParts] = command.args;
          const rejected = await apiClient.rejectTicket(ticketId ?? '', reasonParts.length === 0 ? undefined : reasonParts.join(' '));
          result = asCommandResult(labelForCommand(command.command), rejected.rejected ? 'Ticket rejected.' : 'Ticket not rejected.');
          break;
        }
        case 'alert': {
          const alerts = await apiClient.alerts();
          result = asCommandResult(labelForCommand(command.command), `Pending alerts: ${alerts.alerts.length}`);
          break;
        }
        case 'ack': {
          const acked = await apiClient.acknowledgeAlert(command.args[0] ?? '');
          result = asCommandResult(labelForCommand(command.command), acked.acknowledged ? 'Alert acknowledged.' : 'Alert not acknowledged.');
          break;
        }
        case 'watchlist': {
          const watchlist = await apiClient.watchlist();
          result = asCommandResult(labelForCommand(command.command), `Watchlist items: ${watchlist.items.length}`);
          break;
        }
        case 'add': {
          await apiClient.addWatchlist(command.args[0] ?? '', command.args[1] ?? 'interesting');
          result = asCommandResult(labelForCommand(command.command), 'Watchlist item added.');
          break;
        }
        case 'portfolio': {
          const portfolio = await apiClient.portfolio();
          result = asCommandResult(labelForCommand(command.command), `Portfolio items: ${portfolio.items.length}`);
          break;
        }
        default:
          return { chunks: [deps.config.responseMessages.validationError] };
      }

      formatted = formatResult(result.label, result.body);
    } else {
      if (!deps.config.commandBehavior.allowFreeTextOperatorQuery || envelope.freeText === null) {
        return { chunks: [deps.config.responseMessages.validationError] };
      }

      const response = await apiClient.chat(envelope.freeText);
      formatted = formatResult(labelForMission(response.missionType), response.response);
    }

    await deps.userChatLinkStore.persistChatIdOnFirstSuccess(principal.userId, incoming.chatId);
    return {
      chunks: splitMessage(formatted, deps.config.delivery.messageMaxLength)
    };
  } catch (error) {
    botLogger.error({
      eventType: 'telegram_handler_failure',
      userId: principal.userId,
      telegramHandle: incoming.username,
      chatId: incoming.chatId,
      reasonCode: 'temporarily_unavailable',
      error: (error as Error).message
    }, 'Telegram handler failed');

    return {
      chunks: [deps.config.responseMessages.temporaryUnavailable]
    };
  }
}
