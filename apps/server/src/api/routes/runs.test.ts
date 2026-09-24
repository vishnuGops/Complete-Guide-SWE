import http from 'node:http';
import type { AddressInfo } from 'node:net';
import Fastify, { type FastifyBaseLogger, type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RunResult } from '@devpromax/shared';
import { createDatabase, IN_MEMORY, type Repositories } from '../../db/index.js';
import { JudgeUnavailableError } from '../../judge/executors/launcher.js';
import type { RunProblemOptions } from '../../judge/index.js';
import { silentLogger } from '../../logger.js';
import type { Catalogue } from '../services/catalogue.js';
import { HttpError, applyErrorHandling } from '../errors.js';
import { CustomTestError, ProblemNotFoundError } from '../services/runService.js';
import { registerRunRoutes, runErrorToHttp } from './runs.js';

/**
 * The run routes' own behaviour: cancelling a run whose client went away, and
 * the error mapping re-verify shares with them. What a Run and a Submit record is
 * `runService.test.ts`; the HTTP surface as a whole is `routes.test.ts`.
 */

let app: FastifyInstance;
let repos: Repositories;

function result(options: RunProblemOptions): RunResult {
  return {
    slug: options.meta.slug,
    language: options.language,
    kind: options.kind,
    problemVersion: options.meta.version,
    verdict: 'AC',
    passed: 0,
    total: 0,
    totalTimeMs: 1,
    compileErrors: [],
    tests: [],
    outputTruncated: false,
    isolationFallback: false,
  };
}

async function build(judge: (options: RunProblemOptions) => Promise<RunResult>) {
  // Widened as `buildServer` does, so the instance is a plain FastifyInstance.
  app = Fastify({ loggerInstance: silentLogger as FastifyBaseLogger });
  applyErrorHandling(app);
  registerRunRoutes(app, {
    repos,
    // The run routes never touch the catalogue; the service loads the problem.
    catalogue: {} as Catalogue,
    judge,
  });
  await app.ready();
}

const BODY = { slug: 'pair-sum-index', language: 'python', code: 'class Solution: pass' };

beforeEach(() => {
  repos = createDatabase({ file: IN_MEMORY });
});

afterEach(async () => {
  await app.close();
  repos.close();
});

describe('cancelling a run when the client goes away (P2-17)', () => {
  it('aborts the judge, and records nothing, when the connection closes first', async () => {
    let started!: () => void;
    const judgeStarted = new Promise<void>((resolve) => {
      started = resolve;
    });
    let sawAbort!: (aborted: boolean) => void;
    const outcome = new Promise<boolean>((resolve) => {
      sawAbort = resolve;
    });

    await build(async (options) => {
      started();
      // A judge that runs until it is told to stop, or gives up after a while.
      const aborted = await new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => resolve(false), 10_000);
        options.signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          resolve(true);
        });
      });
      sawAbort(aborted);
      throw Object.assign(new Error('cancelled'), { name: 'AbortError' });
    });
    await app.listen({ host: '127.0.0.1', port: 0 });
    const { port } = app.server.address() as AddressInfo;

    const request = http.request({
      host: '127.0.0.1',
      port,
      method: 'POST',
      path: '/api/submit',
      headers: { 'content-type': 'application/json' },
    });
    request.on('error', () => undefined);
    request.end(JSON.stringify(BODY));

    await judgeStarted;
    request.destroy();

    expect(await outcome).toBe(true);
    expect(repos.submissions.list()).toEqual([]);
    expect(repos.events.list()).toEqual([]);
  });

  it('leaves a run alone that the client waits for, before and after it answers', async () => {
    let signal: AbortSignal | undefined;
    let abortedWhileRunning: boolean | undefined;
    await build(async (options) => {
      signal = options.signal;
      // Long enough for Node to have closed the *request* stream, which is
      // the event this must not be listening to.
      await new Promise((resolve) => setTimeout(resolve, 200));
      abortedWhileRunning = options.signal?.aborted;
      return result(options);
    });
    await app.listen({ host: '127.0.0.1', port: 0 });
    const { port } = app.server.address() as AddressInfo;

    const status = await new Promise<number | undefined>((resolve, reject) => {
      const request = http.request(
        {
          host: '127.0.0.1',
          port,
          method: 'POST',
          path: '/api/run',
          headers: { 'content-type': 'application/json' },
        },
        (response) => {
          response.resume();
          response.on('end', () => resolve(response.statusCode));
        },
      );
      request.on('error', reject);
      request.end(JSON.stringify(BODY));
    });

    expect(status).toBe(200);
    expect(abortedWhileRunning).toBe(false);
    // A response that was sent is not a client that left.
    expect(signal?.aborted).toBe(false);
  });
});

describe('runErrorToHttp (P2-19)', () => {
  const log = silentLogger;

  it('maps the service errors to their statuses', () => {
    expect(runErrorToHttp(new ProblemNotFoundError('x'), 'python', log)).toMatchObject({
      statusCode: 404,
    });
    expect(
      runErrorToHttp(new CustomTestError([{ case: 2, message: 'bad' }]), 'python', log),
    ).toMatchObject({ statusCode: 400, issues: [{ path: 'customTests[2]', message: 'bad' }] });
  });

  it('passes through what already knows its answer', () => {
    const http404 = new HttpError(404, 'NotFound', 'gone');
    const unavailable = new JudgeUnavailableError('Docker is not running');
    expect(runErrorToHttp(http404, 'java', log)).toBe(http404);
    expect(runErrorToHttp(unavailable, 'java', log)).toBe(unavailable);
  });

  it('calls a cancelled run a closed request, not a judge failure', () => {
    const aborted = Object.assign(new Error('x'), { name: 'AbortError' });
    expect(runErrorToHttp(aborted, 'java', log)).toMatchObject({
      statusCode: 499,
      tag: 'ClientClosedRequest',
    });
  });

  it('keeps Node details out of the message, naming only the fix', () => {
    const missing = Object.assign(new Error('spawn C:\\jdk\\bin\\javac ENOENT'), {
      code: 'ENOENT',
    });
    const mapped = runErrorToHttp(missing, 'java', log);
    expect(mapped).toMatchObject({ statusCode: 500, tag: 'JudgeError' });
    expect(mapped.message).toContain('could not start Java');
    expect(mapped.message).not.toContain('C:\\jdk');

    expect(runErrorToHttp(new Error('boom'), 'python', log).message).toMatch(/server log/);
  });
});
