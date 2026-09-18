import { describe, expect, it } from 'vitest';
import { pino } from 'pino';
import { REDACT_PATHS } from './logger.js';

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
