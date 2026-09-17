import { pino } from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info'),
  // API keys must never reach a log line (see CLAUDE.md > Secrets).
  redact: {
    paths: [
      'apiKey',
      '*.apiKey',
      'req.headers.authorization',
      'req.headers["x-api-key"]',
      'settings.apiKey',
    ],
    censor: '[redacted]',
  },
  ...(isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss' },
        },
      }
    : {}),
});
