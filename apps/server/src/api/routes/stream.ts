import type { FastifyReply } from 'fastify';
import type { CoachStreamEvent } from '@devpromax/shared';
import { logger } from '../../logger.js';
import { HttpError } from '../errors.js';

/**
 * Server-sent events, for the two features that stream a model's answer
 * (ROADMAP P5-3, shared with P9-1).
 *
 * Its own module because the mock interview needs exactly this and a second
 * copy would be a second place for the cancel-on-socket-close behaviour to be
 * subtly different - which is the behaviour that stops a turn nobody is looking
 * at from being generated, billed and stored.
 */

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
export async function streamEvents(
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
    // a cancelled turn record its cost and skip persisting a half answer. Its
    // promise rejects if one of those blocks throws, and nothing else awaits
    // it: unhandled, that rejection would take the whole server down over a
    // closed browser tab (P3-10).
    events.return(undefined).catch((error: unknown) => {
      logger.error({ err: error }, 'cancelling a stream failed');
    });
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
      // `hijack()` takes the response away from Fastify, and the `onSend` hook
      // that adds these to every other response with it (ROADMAP P5-10). An
      // event stream a browser might sniff as something else is the one kind
      // of response where that matters least and costs nothing to fix.
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
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
