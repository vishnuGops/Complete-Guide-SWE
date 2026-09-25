import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { FastifyBaseLogger } from 'fastify';
import { pino } from 'pino';
import { createDatabase, IN_MEMORY } from './db/index.js';
import { buildServer } from './index.js';
import { REDACT_PATHS, fileLogger, logsRequests, rotateLog } from './logger.js';

/**
 * That an API key cannot reach a log line (ROADMAP P5-6, CLAUDE.md > Secrets).
 *
 * This is the one rule in the app whose breach is invisible from the outside:
 * nothing looks wrong, the key is simply sitting in a file. So rather than
 * trusting the redact list by reading it, each shape the app actually logs is
 * written through a real pino instance and the output is searched for the
 * secret.
 *
 * The trap being defended against is pino's `*`, which matches exactly one
 * level. `*.apiKey` covers `{coach: {apiKey}}` and silently does not cover
 * `{settings: {coach: {apiKey}}}` - and the settings object is passed around
 * one level deeper than the coach object inside it.
 */

const SECRET = 'sk-ant-api03-DO-NOT-LOG-ME';

/** Captures what a logger configured exactly like ours would write. */
function capture(payload: object, message = 'test'): string {
  const lines: string[] = [];
  const logger = pino(
    { redact: { paths: REDACT_PATHS, censor: '[redacted]' } },
    { write: (line: string) => lines.push(line) },
  );
  logger.info(payload, message);
  return lines.join('\n');
}

describe('log redaction', () => {
  it.each([
    ['bare', { apiKey: SECRET }],
    ['one level down', { coach: { apiKey: SECRET } }],
    ['the settings object as the API holds it', { settings: { coach: { apiKey: SECRET } } }],
    ['three levels down', { a: { settings: { coach: { apiKey: SECRET } } } }],
    ['an Anthropic request header', { req: { headers: { 'x-api-key': SECRET } } }],
    ['a Gemini request header', { req: { headers: { 'x-goog-api-key': SECRET } } }],
    ['a bearer token', { req: { headers: { authorization: `Bearer ${SECRET}` } } }],
    ['headers on an error', { err: { headers: { 'x-api-key': SECRET } } }],
  ])('redacts %s', (_name, payload) => {
    const output = capture(payload);

    expect(output).not.toContain(SECRET);
    expect(output).toContain('[redacted]');
  });

  it('still logs the rest of the object', () => {
    // Redaction that ate the surrounding context would make the log useless and
    // tempt someone into logging the object a second, unredacted way.
    const output = capture({ settings: { coach: { apiKey: SECRET, provider: 'anthropic' } } });

    expect(output).toContain('anthropic');
    expect(output).not.toContain(SECRET);
  });
});

describe('the log file (P10-2)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'devpromax-logs-'));
  const file = path.join(dir, 'logs', 'devpromax.log');

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('writes there, making the folder, with the same redaction as the console', () => {
    const logger = fileLogger(file);
    logger.info({ settings: { coach: { apiKey: SECRET, provider: 'gemini' } } }, 'saved');
    logger.flush();

    const written = fs.readFileSync(file, 'utf8');
    expect(written).toContain('saved');
    expect(written).toContain('gemini');
    expect(written).not.toContain(SECRET);
  });

  it('keeps the last three, oldest dropped, once the current one outgrows the limit', () => {
    const rotating = path.join(dir, 'rotating.log');
    const limits = { maxBytes: 10, keep: 3 };
    fs.writeFileSync(rotating, 'first run, long enough');
    rotateLog(rotating, limits);
    fs.writeFileSync(rotating, 'second run, long enough');
    rotateLog(rotating, limits);
    fs.writeFileSync(rotating, 'third run, long enough');
    rotateLog(rotating, limits);

    expect(fs.existsSync(rotating)).toBe(false);
    expect(fs.readFileSync(`${rotating}.1`, 'utf8')).toBe('third run, long enough');
    expect(fs.readFileSync(`${rotating}.2`, 'utf8')).toBe('second run, long enough');
    expect(fs.existsSync(`${rotating}.3`)).toBe(false);
  });

  it('leaves a log under the limit, and a missing one, alone', () => {
    const small = path.join(dir, 'small.log');
    fs.writeFileSync(small, 'short');
    rotateLog(small, { maxBytes: 10, keep: 3 });
    rotateLog(path.join(dir, 'never-written.log'), { maxBytes: 10, keep: 3 });

    expect(fs.readFileSync(small, 'utf8')).toBe('short');
    expect(fs.existsSync(`${small}.1`)).toBe(false);
  });
});

describe('request lines (P10-2)', () => {
  it('are for development only', () => {
    expect(logsRequests({ NODE_ENV: 'production' })).toBe(false);
    expect(logsRequests({ NODE_ENV: 'development' })).toBe(true);
    expect(logsRequests({})).toBe(true);
  });

  it('leave a server that is told not to log them silent about ordinary requests', async () => {
    const lines: string[] = [];
    const capturing = pino({ level: 'info' }, { write: (line: string) => lines.push(line) });
    const app = await buildServer({
      repositories: createDatabase({ file: IN_MEMORY }),
      logger: capturing as FastifyBaseLogger,
      logRequests: false,
    });
    await app.inject({ method: 'GET', url: '/health', headers: { host: '127.0.0.1:5174' } });
    await app.close();

    expect(lines.join('\n')).not.toContain('incoming request');
    expect(lines.join('\n')).not.toContain('request completed');
  });

  it('and one told to log them does, which is what the test above would miss if it broke', async () => {
    const lines: string[] = [];
    const capturing = pino({ level: 'info' }, { write: (line: string) => lines.push(line) });
    const app = await buildServer({
      repositories: createDatabase({ file: IN_MEMORY }),
      logger: capturing as FastifyBaseLogger,
      logRequests: true,
    });
    await app.inject({ method: 'GET', url: '/health', headers: { host: '127.0.0.1:5174' } });
    await app.close();

    expect(lines.join('\n')).toContain('request completed');
  });
});
