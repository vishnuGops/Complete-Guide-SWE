import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { serverConfig } from '../config.js';

/**
 * Local-server hardening (ROADMAP D15, P2-5).
 *
 * The threat model is specific and worth stating, because it is the only reason
 * any of this exists: this server executes arbitrary code on the user's machine,
 * on purpose. Protecting the user from their own solutions is not the goal — it
 * is their code, their machine. The goal is to stop *anything else on the
 * machine* from reaching the endpoint that runs code.
 *
 * The concrete attack is a web page in another tab. It cannot read our responses
 * (no CORS headers are ever sent), but a plain form POST or a no-cors fetch is
 * fire-and-forget: it does not need to read the reply to have made us compile
 * and execute something. Three independent checks close that off, and each one
 * would be sufficient on its own:
 *
 *  1. Bind to 127.0.0.1, so nothing off-machine can connect at all.
 *  2. Reject any request whose Host is not a loopback name. A DNS rebinding
 *     attack resolves an attacker-controlled domain to 127.0.0.1 and then talks
 *     to us as a same-origin peer; the Host header still says their domain.
 *  3. Require a custom header on every /api request. Adding one makes the
 *     request non-simple, so the browser must send a CORS preflight first — and
 *     we answer no preflight, so the real request is never sent.
 *
 * Plus: JSON bodies only, which rules out the `<form>` content types entirely,
 * since a form POST cannot set Content-Type to application/json.
 */

const JSON_BODY_METHODS = new Set(['POST', 'PUT', 'PATCH']);

/** Hosts that mean "this machine". Anything else is refused, port included. */
function isLoopbackHost(host: string | undefined): boolean {
  if (!host) return false;

  // Strip the port, taking care of the bracketed IPv6 form.
  let name = host;
  if (name.startsWith('[')) {
    const end = name.indexOf(']');
    if (end === -1) return false;
    name = name.slice(1, end);
  } else {
    const colon = name.lastIndexOf(':');
    if (colon !== -1) name = name.slice(0, colon);
  }

  const lowered = name.toLowerCase();
  return lowered === 'localhost' || lowered === '127.0.0.1' || lowered === '::1';
}

/** `path` is `prefix` itself or something below it - `/api/x`, not `/apiary`. */
function isUnder(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

/**
 * Whether a request is addressed to `prefix`, keyed on what the router matched
 * rather than on the raw URL (ROADMAP P3-8).
 *
 * `request.url` is the path as it was sent, and the router decodes it before
 * matching: `/%61pi/settings/reset-progress` reached the reset route while
 * `startsWith('/api')` said it was not an API request, so it skipped the client
 * header and the content-type check - the two checks that stop another tab. The
 * matched route pattern is what the router will actually run, so it comes
 * first. The decoded path is the fallback for requests that matched nothing (a
 * 404) or matched a wildcard such as the static files' `/*`, and it is read
 * generously - repeated slashes collapsed, case ignored - because the cost of
 * treating a stray path as an API request is a 403 on something that would
 * have been a 404 anyway. A path that does not even decode is treated as API:
 * refusing is the safe way to be wrong.
 */
export function isApiRequest(request: FastifyRequest, prefix = '/api'): boolean {
  const route = request.routeOptions.url;
  if (route !== undefined && isUnder(route, prefix)) return true;

  const rawPath = request.url.split('?', 1)[0] ?? '';
  let decoded: string;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    return true;
  }
  return isUnder(decoded.replace(/\/{2,}/g, '/').toLowerCase(), prefix.toLowerCase());
}

export interface HardeningOptions {
  /** Paths the checks apply to. Everything else (e.g. /health) is left alone. */
  prefix?: string;
}

export function applyHardening(app: FastifyInstance, options: HardeningOptions = {}): void {
  const prefix = options.prefix ?? '/api';

  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // The Host check guards the whole server, not just the API: a rebinding
    // attack against any route is still a foothold.
    if (!isLoopbackHost(request.headers.host)) {
      await reply.code(421).send({
        error: 'MisdirectedRequest',
        message: 'DevProMax only serves requests addressed to localhost.',
      });
      return;
    }

    if (!isApiRequest(request, prefix)) return;

    if (request.headers[serverConfig.clientHeader] === undefined) {
      await reply.code(403).send({
        error: 'Forbidden',
        message: `Requests to ${prefix} must carry the ${serverConfig.clientHeader} header.`,
      });
      return;
    }

    if (JSON_BODY_METHODS.has(request.method)) {
      const contentType = request.headers['content-type'];
      // A body is optional; a body in the wrong format is not. A chunked body
      // has no length header and is still a body.
      const hasBody =
        (request.headers['content-length'] !== undefined &&
          request.headers['content-length'] !== '0') ||
        request.headers['transfer-encoding'] !== undefined;
      if (hasBody && !contentType?.toLowerCase().startsWith('application/json')) {
        await reply.code(415).send({
          error: 'UnsupportedMediaType',
          message: 'DevProMax accepts application/json request bodies only.',
        });
      }
    }
  });

  // No CORS headers are ever sent. This is deliberate and load-bearing: it is
  // what makes a cross-origin preflight fail, and it is why there is no cors
  // plugin in this project.
  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'no-referrer');
    return payload;
  });
}

export const __testing = { isLoopbackHost, isUnder };
