import pino from 'pino';

export const botLogger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  name: 'telegram-bot'
});
