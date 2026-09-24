import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../index.js';
import { serverConfig } from '../config.js';
import { createDatabase, IN_MEMORY, openDatabase, type Repositories } from '../db/index.js';
import { silentLogger } from '../logger.js';
import { __testing } from './hardening.js';

const CLIENT_HEADER = serverConfig.clientHeader;
let app: FastifyInstance;
let repos: Repositories;

beforeEach(async () => {
  // In memory: without it buildServer opens data/devpromax.db, and this suite
  // used to migrate the owner's real database on every run (P3-8).
  repos = createDatabase({ file: IN_MEMORY });
  app = await buildServer({ logger: silentLogger, repositories: repos });
  app.post('/api/echo', async (request) => ({ body: request.body }));
  app.get('/api/ping', async () => ({ ok: true }));
  app.post('/outside', async (request) => ({ body: request.body }));
  await app.ready();
});

afterEach(async () => {
  await app.close();
  repos.close();
});

describe('test isolation', () => {
  it('refuses to open the default database file under Vitest', () => {
    expect(() => openDatabase()).toThrow(/without a file under Vitest/);
    expect(() => createDatabase()).toThrow(/without a file under Vitest/);
  });
});

describe('isLoopbackHost', () => {
  it.each([
    '127.0.0.1',
    '127.0.0.1:5174',
    'localhost',
    'localhost:5174',
    'LOCALHOST:5174',
    '[::1]',
    '[::1]:5174',
  ])('accepts %s', (host) => {
    expect(__testing.isLoopbackHost(host)).toBe(true);
  });

  it.each([
    'evil.example.com',
    'evil.example.com:5174',
    // The shape a DNS rebinding attack arrives in: resolved to 127.0.0.1, but
    // the Host header still names the attacker's domain.
    'rebind.attacker.test:5174',
    'localhost.attacker.test',
    '127.0.0.1.attacker.test',
    '192.168.1.10:5174',
    '[2001:db8::1]:5174',
  ])('rejects %s', (host) => {
    expect(__testing.isLoopbackHost(host)).toBe(false);
  });

  it('rejects an absent Host header', () => {
    expect(__testing.isLoopbackHost(undefined)).toBe(false);
    expect(__testing.isLoopbackHost('')).toBe(false);
  });
});

describe('Host allow-list', () => {
  it('serves a request addressed to localhost', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { host: '127.0.0.1:5174' },
    });
    expect(response.statusCode).toBe(200);
  });

  it('refuses a request addressed to any other name', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { host: 'rebind.attacker.test' },
    });
    expect(response.statusCode).toBe(421);
    expect(response.json().error).toBe('MisdirectedRequest');
  });

  it('guards every route, not only /api', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/echo',
      headers: { host: 'evil.example.com', [CLIENT_HEADER]: '1' },
      payload: {},
    });
    expect(response.statusCode).toBe(421);
  });
});

describe('client header', () => {
  it('refuses an /api request without it', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/ping',
      headers: { host: '127.0.0.1:5174' },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().message).toContain(CLIENT_HEADER);
  });

  it('accepts an /api request carrying it', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/ping',
      headers: { host: '127.0.0.1:5174', [CLIENT_HEADER]: '1' },
    });
    expect(response.statusCode).toBe(200);
  });

  it('accepts any value, since the header exists to force a CORS preflight', async () => {
    // It is not a secret and is not treated as one: its whole job is to make the
    // request non-simple so a cross-origin caller must preflight first.
    const response = await app.inject({
      method: 'GET',
      url: '/api/ping',
      headers: { host: '127.0.0.1:5174', [CLIENT_HEADER]: '' },
    });
    expect(response.statusCode).toBe(200);
  });

  it('leaves non-API routes alone, so /health stays a plain probe', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { host: '127.0.0.1:5174' },
    });
    expect(response.statusCode).toBe(200);
  });
});

describe('request bodies', () => {
  const headers = { host: '127.0.0.1:5174', [CLIENT_HEADER]: '1' };

  it('accepts application/json', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/echo',
      headers: { ...headers, 'content-type': 'application/json' },
      payload: JSON.stringify({ hello: 'world' }),
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().body).toEqual({ hello: 'world' });
  });

  it('accepts application/json with a charset', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/echo',
      headers: { ...headers, 'content-type': 'application/json; charset=utf-8' },
      payload: JSON.stringify({ hello: 'world' }),
    });
    expect(response.statusCode).toBe(200);
  });

  it('refuses a form-encoded body, which is what a cross-origin form can send', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/echo',
      headers: { ...headers, 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'a=1',
    });
    expect(response.statusCode).toBe(415);
  });

  it('refuses text/plain, the other content type a simple request may use', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/echo',
      headers: { ...headers, 'content-type': 'text/plain' },
      payload: 'hello',
    });
    expect(response.statusCode).toBe(415);
  });

  it('has no text/plain parser at all, so a route outside /api refuses it too', async () => {
    // The second lock behind the hook (P3-8): whatever the hook decides about a
    // path, Fastify cannot turn a text/plain body into something a route reads.
    const response = await app.inject({
      method: 'POST',
      url: '/outside',
      headers: { host: '127.0.0.1:5174', 'content-type': 'text/plain' },
      payload: 'hello',
    });
    expect(response.statusCode).toBe(415);
  });
});

describe('the matched route decides, not the raw URL (P3-8)', () => {
  // Each of these reaches /api/echo through the router, and before P3-8 each
  // skipped the /api checks because the raw URL did not start with "/api".
  const disguised = ['/%61pi/echo', '/%61%70%69/echo', '/api%2Fecho'];

  it.each(disguised)('refuses %s without the client header', async (url) => {
    const response = await app.inject({
      method: 'POST',
      url,
      headers: { host: '127.0.0.1:5174', 'content-type': 'application/json' },
      payload: '{}',
    });
    expect(response.statusCode).toBe(403);
  });

  it('refuses a percent-encoded path carrying a text/plain body', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/%61pi/echo',
      headers: { host: '127.0.0.1:5174', [CLIENT_HEADER]: '1', 'content-type': 'text/plain' },
      payload: 'hello',
    });
    expect(response.statusCode).toBe(415);
  });

  it('refuses a chunked text/plain body, which carries no length header', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/echo',
      headers: {
        host: '127.0.0.1:5174',
        [CLIENT_HEADER]: '1',
        'content-type': 'text/plain',
        'transfer-encoding': 'chunked',
      },
      payload: 'hello',
    });
    expect(response.statusCode).toBe(415);
  });

  it('treats an unmatched API-looking path as API, so it still needs the header', async () => {
    for (const url of ['/%61pi/nope', '//api/nope', '/API/nope']) {
      const response = await app.inject({
        method: 'GET',
        url,
        headers: { host: '127.0.0.1:5174' },
      });
      expect(response.statusCode, url).toBe(403);
    }
  });

  it('does not mistake a sibling path for the prefix', () => {
    expect(__testing.isUnder('/api', '/api')).toBe(true);
    expect(__testing.isUnder('/api/run', '/api')).toBe(true);
    expect(__testing.isUnder('/apiary', '/api')).toBe(false);
  });
});

describe('response headers', () => {
  it('sends no CORS headers at all, which is what makes a preflight fail', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/ping',
      headers: { host: '127.0.0.1:5174', [CLIENT_HEADER]: '1', origin: 'https://evil.example' },
    });

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
    expect(response.headers['access-control-allow-headers']).toBeUndefined();
    expect(response.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('answers no preflight', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/api/ping',
      headers: {
        host: '127.0.0.1:5174',
        origin: 'https://evil.example',
        'access-control-request-method': 'POST',
        'access-control-request-headers': CLIENT_HEADER,
      },
    });

    expect(response.statusCode).toBeGreaterThanOrEqual(400);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('sets the sniffing and referrer protections', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { host: '127.0.0.1:5174' },
    });
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['referrer-policy']).toBe('no-referrer');
  });
});

describe('binding', () => {
  it('is configured for loopback only', () => {
    // 0.0.0.0 here would expose a code runner to the local network.
    expect(serverConfig.host).toBe('127.0.0.1');
  });
});
