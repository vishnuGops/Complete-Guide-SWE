import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { serverConfig } from '../config.js';
import { createDatabase, IN_MEMORY, type Repositories } from '../db/index.js';
import { buildServer } from '../index.js';
import { silentLogger } from '../logger.js';
import { makeCatalogue, writeProblem } from '../problems/__fixtures__/factory.js';
import { hasWebBuild } from './web.js';

/**
 * Serving the built app from the API process (ROADMAP P3-6, D24).
 *
 * A stand-in `dist/` rather than the real one: these tests must not depend on
 * whether someone has run `npm run build`, and what is under test is the
 * routing - which paths get the page, which keep their 404 - not Vite's output.
 */

let app: FastifyInstance;
let repos: Repositories;
let problems: string;
let webRoot: string;

const INDEX = '<!doctype html><title>DevProMax</title><div id="root"></div>';

function get(url: string, headers: Record<string, string> = {}) {
  return app.inject({ method: 'GET', url, headers: { host: '127.0.0.1:5174', ...headers } });
}

beforeEach(async () => {
  problems = makeCatalogue();
  writeProblem(problems, { topic: 'arrays', slug: 'pair-sum-index' });

  webRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'devpromax-web-'));
  fs.writeFileSync(path.join(webRoot, 'index.html'), INDEX, 'utf8');
  fs.mkdirSync(path.join(webRoot, 'assets'));
  fs.writeFileSync(path.join(webRoot, 'assets', 'app-abc123.js'), 'console.log(1)\n', 'utf8');

  repos = createDatabase({ file: IN_MEMORY });
  app = await buildServer({
    logger: silentLogger,
    repositories: repos,
    problemsRoot: problems,
    webRoot,
  });
  await app.ready();
});

afterEach(async () => {
  await app.close();
  repos.close();
  fs.rmSync(problems, { recursive: true, force: true });
  fs.rmSync(webRoot, { recursive: true, force: true });
});

describe('the built app', () => {
  it('serves the page at the root', async () => {
    const response = await get('/');
    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('id="root"');
  });

  it('serves a hashed asset, and lets it be cached', async () => {
    const response = await get('/assets/app-abc123.js');
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toContain('max-age=31536000');
  });

  it('never lets the page itself be cached', async () => {
    // A cached entry document survives a rebuild and then asks for script
    // files that no longer exist, which looks like a broken build.
    const response = await get('/index.html');
    expect(response.headers['cache-control']).toBe('no-cache');
  });

  it('answers a router path with the app, so a reload works', async () => {
    const response = await get('/problems/pair-sum-index');
    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('id="root"');
  });

  it('keeps a real 404 for an unknown API route', async () => {
    // A mistyped endpoint answering with an HTML page is the kind of thing
    // that costs an afternoon.
    const response = await get('/api/nope', { [serverConfig.clientHeader]: 'devpromax-web' });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: 'NotFound' });
  });

  it('keeps the client-header rule an API rule', async () => {
    // A page load cannot carry a custom header, so applying D15's header check
    // here would make the app unreachable by the only thing that loads it.
    const page = await get('/');
    expect(page.statusCode).toBe(200);

    const api = await get('/api/problems');
    expect(api.statusCode).toBe(403);
  });

  it('still refuses a request addressed to somewhere else', async () => {
    // The Host allow-list guards the whole server, page loads included: a DNS
    // rebinding attack resolves an attacker's domain to 127.0.0.1 (D15).
    const response = await get('/', { host: 'evil.example.com' });
    expect(response.statusCode).toBe(421);
  });

  it('does not answer a POST to an unknown path with the page', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/problems/pair-sum-index',
      headers: { host: '127.0.0.1:5174' },
    });
    expect(response.statusCode).toBe(404);
  });
});

describe('hasWebBuild', () => {
  it('is true only when there is an index.html to serve', () => {
    expect(hasWebBuild(webRoot)).toBe(true);
    expect(hasWebBuild(path.join(webRoot, 'assets'))).toBe(false);
    expect(hasWebBuild(path.join(webRoot, 'nowhere'))).toBe(false);
  });
});
