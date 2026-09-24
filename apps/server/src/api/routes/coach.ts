import type { FastifyInstance } from 'fastify';
import { coachChatRequestSchema, coachFeedbackRequestSchema } from '@devpromax/shared';
import { streamChat, streamFeedback } from '../services/coachService.js';
import { parseInput } from '../errors.js';
import { streamEvents } from './stream.js';
import type { ApiDeps } from './types.js';

/**
 * The two coach routes (ROADMAP P5-3, deferred here from P3-1).
 *
 * Both answer with `text/event-stream` rather than JSON, and that choice forces
 * an awkwardness worth naming: **once the first frame is written, the status
 * code is already sent.** A provider that fails on the third token cannot be
 * reported as a 502. So failures after the stream opens travel as `error`
 * *events*, and only the failures that happen before it - an invalid body, an
 * unknown slug - get a status code.
 *
 * The client therefore has to read events to know whether a turn succeeded.
 * That is the honest shape of the thing: a stream that breaks halfway is a
 * different event from a request that was refused, and flattening them into one
 * status would lose the half of the answer the user can already see.
 */
export function registerCoachRoutes(app: FastifyInstance, deps: ApiDeps): void {
  app.post('/api/coach/feedback', async (request, reply) => {
    const body = parseInput(coachFeedbackRequestSchema, request.body, 'body');
    return streamEvents(reply, (signal) => streamFeedback(body, deps, signal));
  });

  app.post('/api/coach/chat', async (request, reply) => {
    const body = parseInput(coachChatRequestSchema, request.body, 'body');
    return streamEvents(reply, (signal) => streamChat(body, deps, signal));
  });
}
