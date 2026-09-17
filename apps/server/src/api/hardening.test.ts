import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../index.js';
import { serverConfig } from '../config.js';
import { __testing } from './hardening.js';

const CLIENT_HEADER = serverConfig.clientHeader;
let app: FastifyInstance;

beforeEach(async () => {
  app = await buildServer();
  app.post('/api/echo', async (request) => ({ body: request.body }));
  app.get('/api/ping', async () => ({ ok: true }));
  await app.ready();
});

afterEach(async () => {
  await app.close();
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
