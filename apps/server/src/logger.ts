import fs from 'node:fs';
import path from 'node:path';
import { destination, pino, type Logger, type LoggerOptions } from 'pino';
import { paths } from './config.js';

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

/**
 * Fastify's `incoming request` and `request completed` lines, one pair per
 * request (ROADMAP P10-2).
 *
 * Kept in development, where they are what a developer reads. Gone in
 * production: an installed copy's console is the one window its user sees, and
 * two lines of JSON per request scrolled the address and any runtime warning
 * off it within a minute of using the app. A request that fails is still
 * logged, by the error handler, with the request it failed on.
 */
export function logsRequests(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV !== 'production';
}

/** The largest a log may start a run at, and how many generations are kept. */
export const LOG_ROTATION: { maxBytes: number; keep: number } = {
  maxBytes: 5 * 1024 * 1024,
  keep: 3,
};

/**
 * Moves `file` aside when it has grown past `maxBytes`: `devpromax.log` becomes
 * `.log.1`, `.1` becomes `.2`, and whatever would be the `keep`th is deleted.
 *
 * At start-up only (ROADMAP P10-2). With request lines gone a session writes
 * little, and rotating under a live stream is the kind of thing that works
 * until Windows refuses to rename a file something has open. Never throws: a
 * log that could not be rotated is a longer log, not a server that will not
 * start.
 */
export function rotateLog(file: string, { maxBytes, keep } = LOG_ROTATION): void {
  try {
    if (fs.statSync(file).size < maxBytes) return;
  } catch {
    return;
  }
  try {
    fs.rmSync(`${file}.${String(keep - 1)}`, { force: true });
    for (let generation = keep - 2; generation >= 1; generation -= 1) {
      const from = `${file}.${String(generation)}`;
      if (fs.existsSync(from)) fs.renameSync(from, `${file}.${String(generation + 1)}`);
    }
    fs.renameSync(file, `${file}.1`);
  } catch {
    // Another process has it open; it is rotated next time.
  }
}

const baseOptions: LoggerOptions = {
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
};

/**
 * A logger that writes to `file`, rotated first, with the same redaction as
 * the console one. Synchronous writes: the server exits with `process.exit`
 * once it has shut down, and a buffered line about why would be lost with it.
 */
export function fileLogger(file: string, options: LoggerOptions = baseOptions): Logger {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  rotateLog(file);
  return pino(options, destination({ dest: file, sync: true }));
}

export const logger: Logger =
  paths.logFile !== null
    ? fileLogger(paths.logFile)
    : pino({
        ...baseOptions,
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
