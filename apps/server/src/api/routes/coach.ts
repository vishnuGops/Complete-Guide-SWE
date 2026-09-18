import type { FastifyInstance, FastifyReply } from 'fastify';
import {
  coachChatRequestSchema,
  coachFeedbackRequestSchema,
  type CoachStreamEvent,
} from '@devpromax/shared';
import { logger } from '../../logger.js';
import { streamChat, streamFeedback } from '../coachService.js';
import { HttpError, parseInput } from '../errors.js';
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
    return pipe(reply, (signal) => streamFeedback(body, deps, signal));
  });

  app.post('/api/coach/chat', async (request, reply) => {
    const body = parseInput(coachChatRequestSchema, request.body, 'body');
    return pipe(reply, (signal) => streamChat(body, deps, signal));
  });
}

/**
 * Writes an event stream, and keeps writing it until the generator is done.
 *
 * `reply.hijack()` takes the response away from Fastify: without it, Fastify
 * would send its own headers and body around ours. From that point this function
 * owns the socket, including ending it - which is why every exit path below goes
 * through `raw.end()`.
 *
 * **The socket closing cancels the turn** (ROADMAP P5-9). Stop, a second AI Help
 * click and navigating away all end the request from the browser's side, and
 * until this listened for that, all three left the vendor request running: the
 * full turn was generated, billed and stored for a page nobody was looking at.
 * The generator is built here rather than passed in so its signal exists before
 * it starts.
 *
 * The listener is on the *response*, not the request. A POST whose body has
 * been read is already complete, and `request.raw` emits `close` for that -
 * before this handler runs, so a listener added here would never hear it and a
 * listener added earlier would fire on every request. `reply.raw`'s `close` is
 * the connection going away, which is the thing being detected.
 */
async function pipe(
  reply: FastifyReply,
  start: (signal: AbortSignal) => AsyncGenerator<CoachStreamEvent>,
): Promise<void> {
  const { raw } = reply;
  const controller = new AbortController();
  const events = start(controller.signal);

  let finished = false;
  const onClose = (): void => {
    if (finished) return;
    controller.abort();
    // `return()` runs the generator's own `finally` blocks, which is what makes
    // a cancelled turn record its cost and skip persisting a half answer.
    void events.return(undefined);
  };
  raw.on('close', onClose);

  try {
    // A generator that throws before its first value - an unknown slug, a
    // missing session - has not written anything yet, so it can still be a
    // status code. `next()` rather than `for await` is what makes that
    // distinction available at all.
    const first = await events.next();

    if (first.done) {
      // Nothing to say, which is not a case the services produce today; an
      // empty 204 is the honest answer rather than an empty event stream.
      reply.code(204);
      return;
    }

    reply.hijack();
    raw.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      // A proxy that buffers an event stream turns streaming into a long pause
      // followed by everything at once, which is the failure this whole feature
      // exists to avoid.
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });

    write(raw, first.value);
    for await (const event of events) write(raw, event);
  } catch (error) {
    if (!reply.sent && !raw.headersSent) throw error;

    // Past the headers, the only way left to say anything is another frame.
    logger.error({ err: error }, 'coach stream failed after headers were sent');
    write(raw, {
      type: 'error',
      message:
        error instanceof HttpError
          ? error.message
          : 'The coach stream ended unexpectedly. Try again.',
      retryable: true,
    });
  } finally {
    finished = true;
    raw.off('close', onClose);
    if (raw.headersSent) raw.end();
  }
}

/**
 * One SSE frame.
 *
 * JSON is written on a single line because a raw newline inside a `data:` line
 * would be read as a field separator and split one event into two - and
 * `feedbackMarkdown` is full of newlines. `JSON.stringify` escapes them, which
 * is the whole reason the payload is JSON rather than the text itself.
 */
function write(raw: FastifyReply['raw'], event: CoachStreamEvent): void {
  raw.write(`data: ${JSON.stringify(event)}\n\n`);
}
