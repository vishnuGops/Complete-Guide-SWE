import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ApiError, ApiIssue } from '@devpromax/shared';

/**
 * One error shape for the whole API (`ApiError` in `packages/shared`).
 *
 * The UI has to be able to tell "you typed something invalid" from "that problem
 * does not exist" from "the judge fell over" without reading prose, so every
 * failure leaves through here with a machine-readable `error` tag and a sentence
 * that is fit to put in front of a person.
 */
export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly tag: string,
    message: string,
    readonly issues?: ApiIssue[],
  ) {
    super(message);
    this.name = 'HttpError';
  }

  toBody(): ApiError {
    return {
      error: this.tag,
      message: this.message,
      ...(this.issues && this.issues.length > 0 ? { issues: this.issues } : {}),
    };
  }
}

export function badRequest(message: string, issues?: ApiIssue[]): HttpError {
  return new HttpError(400, 'BadRequest', message, issues);
}

export function notFound(message: string): HttpError {
  return new HttpError(404, 'NotFound', message);
}

/** Dotted/indexed path of a zod issue, matching the problem validator's style. */
function formatPath(path: readonly PropertyKey[]): string | undefined {
  if (path.length === 0) return undefined;
  return path.reduce<string>((acc, segment) => {
    if (typeof segment === 'number') return `${acc}[${segment}]`;
    return acc === '' ? String(segment) : `${acc}.${String(segment)}`;
  }, '');
}

export function issuesFromZod(error: z.ZodError): ApiIssue[] {
  return error.issues.map((issue) => {
    const path = formatPath(issue.path);
    return { ...(path !== undefined ? { path } : {}), message: issue.message };
  });
}

/**
 * Parses one part of a request, or fails with a 400 that says which part and
 * which field. Routes never touch `request.body` untyped: what arrives is
 * whatever was posted, and the schema is the only thing that makes it a type.
 */
export function parseInput<T extends z.ZodType>(
  schema: T,
  value: unknown,
  what: 'body' | 'query' | 'params',
): z.infer<T> {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  throw badRequest(`Invalid request ${what}.`, issuesFromZod(result.error));
}

/**
 * Installs the error and not-found handlers.
 *
 * Fastify's defaults produce a different shape from ours (`statusCode`/`error`/
 * `message`), which would mean the UI had two error formats to handle: one for
 * the failures we anticipated and one for everything else.
 */
export function applyErrorHandling(app: FastifyInstance): void {
  app.setNotFoundHandler(async (request, reply) => {
    await reply.code(404).send({
      error: 'NotFound',
      message: `No route for ${request.method} ${request.url}.`,
    } satisfies ApiError);
  });

  app.setErrorHandler(async (error, request, reply) => {
    if (error instanceof HttpError) {
      // Client mistakes are not incidents; log them at debug so a noisy UI bug
      // cannot bury a real error in the same stream.
      request.log.debug({ err: error, url: request.url }, 'request rejected');
      await reply.code(error.statusCode).send(error.toBody());
      return;
    }

    if (error instanceof z.ZodError) {
      await reply.code(400).send({
        error: 'BadRequest',
        message: 'Invalid request.',
        issues: issuesFromZod(error),
      } satisfies ApiError);
      return;
    }

    // Fastify raises these before a route sees the body: malformed JSON, a body
    // over the size limit. They are the client's fault, not ours.
    const fastifyCode = (error as { code?: string }).code;
    if (fastifyCode === 'FST_ERR_CTP_INVALID_MEDIA_TYPE') {
      await reply.code(415).send({
        error: 'UnsupportedMediaType',
        message: 'DevProMax accepts application/json request bodies only.',
      } satisfies ApiError);
      return;
    }
    if (typeof fastifyCode === 'string' && fastifyCode.startsWith('FST_ERR_CTP_')) {
      await reply.code(400).send({
        error: 'BadRequest',
        message: 'The request body could not be read as JSON.',
      } satisfies ApiError);
      return;
    }

    request.log.error({ err: error, url: request.url }, 'unhandled request error');
    await reply.code(500).send({
      error: 'InternalError',
      message: 'Something went wrong on the server. The details are in the server log.',
    } satisfies ApiError);
  });
}
