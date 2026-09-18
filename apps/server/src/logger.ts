import { pino } from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

/** Exported so `logger.test.ts` can prove each path against a real pino instance. */
export const REDACT_PATHS = [
  'apiKey',
  '*.apiKey',
  '*.*.apiKey',
  '*.*.*.apiKey',
  'coach.apiKey',
  'settings.apiKey',
  'settings.coach.apiKey',
  'req.headers.authorization',
  'req.headers["x-api-key"]',
  'req.headers["x-goog-api-key"]',
  'headers["x-api-key"]',
  'headers["x-goog-api-key"]',
  'err.headers["x-api-key"]',
  'err.headers["x-goog-api-key"]',
];

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info'),
  /**
   * API keys must never reach a log line (CLAUDE.md > Secrets).
   *
   * Pino's `*` matches exactly one level, which is the trap this list has to
   * be written around: `*.apiKey` covers `{coach: {apiKey}}` but not
   * `{settings: {coach: {apiKey}}}`, and the settings object is routinely
   * passed around one level deeper than the coach object it contains. Every
   * depth the app actually produces is spelled out rather than assumed, and
   * `logger.test.ts` asserts each one.
   *
   * Both vendors' key headers are listed, on the request and on any error that
   * carries the request that failed.
   */
  redact: {
    paths: REDACT_PATHS,
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

/**
 * A logger that says nothing. Tests pass this to `buildServer` so a suite that
 * makes a hundred requests does not bury its own failures in request logs.
 */
export const silentLogger = pino({ level: 'silent' });
