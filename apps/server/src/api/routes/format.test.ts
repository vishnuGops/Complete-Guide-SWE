import fs from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { LightMyRequestResponse } from 'fastify';
import {
  MAX_CODE_BYTES,
  formatResponseSchema,
  formattersResponseSchema,
  type FormatResponse,
  type FormatterStatus,
  type Language,
} from '@devpromax/shared';
import { serverConfig } from '../../config.js';
import { createDatabase, IN_MEMORY, type Repositories } from '../../db/index.js';
import type { Formatters } from '../../toolchain/formatters.js';
import { buildServer } from '../../index.js';
import { silentLogger } from '../../logger.js';
import { makeCatalogue } from '../../problems/__fixtures__/factory.js';

/**
 * `GET` and `POST /api/format` (ROADMAP P9-5), over stand-in formatters.
 *
 * What the formatters do is `formatters.test.ts`'s business; this is about the
 * boundary - validation, the response shapes, `?refresh=1` reaching the
 * detection, and formatting leaving progress and drafts alone.
 */

let app: FastifyInstance;
let repos: Repositories;
let root: string;
let refreshes: boolean[];
let formatted: { language: Language; code: string }[];

const STATUS: FormatterStatus[] = [
  {
    language: 'python',
    name: 'black',
    available: true,
    version: '26.5.1',
    command: 'black',
    guidance: null,
  },
  {
    language: 'java',
    name: 'google-java-format',
    available: false,
    version: null,
    command: 'google-java-format',
    guidance: 'Download it.',
  },
];

const fakeFormatters: Formatters = {
  status: (refresh = false) => {
    refreshes.push(refresh);
    return Promise.resolve(STATUS);
  },
  format: (language, code): Promise<FormatResponse> => {
    formatted.push({ language, code });
    if (language === 'java') {
      return Promise.resolve({ outcome: 'unavailable', message: 'not installed' });
    }
    if (code.includes('(')) {
      return Promise.resolve({
        outcome: 'invalid',
        message: 'Cannot parse: 1:2',
        line: 1,
        column: 2,
      });
    }
    return Promise.resolve({ outcome: 'formatted', code: `${code.trim()}\n`, changed: true });
  },
};

function api(
  method: 'GET' | 'POST',
  url: string,
  payload?: object,
): Promise<LightMyRequestResponse> {
  return app.inject({
    method,
    url,
    ...(payload !== undefined ? { payload } : {}),
    headers: { host: '127.0.0.1:5174', [serverConfig.clientHeader]: 'devpromax-web' },
  });
}

beforeEach(async () => {
  root = makeCatalogue();
  repos = createDatabase({ file: IN_MEMORY });
  refreshes = [];
  formatted = [];
  app = await buildServer({
    logger: silentLogger,
    repositories: repos,
    problemsRoot: root,
    env: {},
    formatters: fakeFormatters,
  });
  await app.ready();
});

afterEach(async () => {
  await app.close();
  repos.close();
  fs.rmSync(root, { recursive: true, force: true });
});

describe('GET /api/format', () => {
  it('lists what was found, from cache', async () => {
    const response = await api('GET', '/api/format');
    expect(response.statusCode).toBe(200);
    expect(formattersResponseSchema.parse(response.json())).toEqual({ formatters: STATUS });
    expect(refreshes).toEqual([false]);
  });

  it('looks again when asked to', async () => {
    await api('GET', '/api/format?refresh=1');
    expect(refreshes).toEqual([true]);
  });

  it('rejects a refresh value it does not understand', async () => {
    expect((await api('GET', '/api/format?refresh=yes')).statusCode).toBe(400);
  });

  it('is behind the same hardening as every other route', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/format',
      headers: { host: '127.0.0.1:5174' },
    });
    expect(response.statusCode).toBe(403);
  });
});

describe('POST /api/format', () => {
  it('formats', async () => {
    const response = await api('POST', '/api/format', { language: 'python', code: '  x = 1  ' });
    expect(response.statusCode).toBe(200);
    expect(formatResponseSchema.parse(response.json())).toEqual({
      outcome: 'formatted',
      code: 'x = 1\n',
      changed: true,
    });
  });

  it('answers 200 with the complaint when the code does not parse', async () => {
    const response = await api('POST', '/api/format', { language: 'python', code: 'f(' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      outcome: 'invalid',
      message: 'Cannot parse: 1:2',
      line: 1,
      column: 2,
    });
  });

  it('answers 200 when the formatter is not installed', async () => {
    const response = await api('POST', '/api/format', { language: 'java', code: 'class A {}' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ outcome: 'unavailable' });
  });

  it.each([
    [{ language: 'cobol', code: 'x' }],
    [{ language: 'python' }],
    [{ language: 'python', code: 'x'.repeat(MAX_CODE_BYTES + 1) }],
  ])('rejects %#', async (body) => {
    expect((await api('POST', '/api/format', body)).statusCode).toBe(400);
    expect(formatted).toEqual([]);
  });

  it('writes nothing: no draft, no progress, no activity', async () => {
    await api('POST', '/api/format', { language: 'python', code: 'x = 1' });
    for (const table of ['drafts', 'problem_progress', 'events', 'submissions']) {
      const row = repos.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number };
      expect(row.n, table).toBe(0);
    }
  });
});
