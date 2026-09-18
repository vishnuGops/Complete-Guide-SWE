import { coachStreamEventSchema, type CoachStreamEvent } from '@devpromax/shared';
import { ApiError } from './client.js';

/**
 * Reading a coaching turn (ROADMAP P5-3).
 *
 * The browser's own `EventSource` cannot be used here: it only issues GET
 * requests, and a coaching turn sends the user's code. So this is `fetch` plus a
 * reader over `response.body`, which is also what lets the request carry the
 * `X-DevProMax-Client` header every `/api` call needs (D15).
 *
 * The framing loop is a near-twin of the server's `coach/sse.ts`, and that is
 * deliberate rather than an oversight: `packages/shared` is schemas and types
 * (CLAUDE.md), and moving forty lines of stream plumbing into it to save a
 * duplicate would put runtime infrastructure in the one package both sides
 * import for its *shapes*. What genuinely must not drift - the event shapes -
 * is shared, and every frame below is parsed through that schema.
 */

const CLIENT_HEADER = 'X-DevProMax-Client';
const CLIENT_NAME = 'devpromax-web';

/** SSE ends a message at a blank line; both line endings are legal. */
const MESSAGE_BOUNDARY = /\r?\n\r?\n/;

export interface CoachStreamOptions {
  /** Aborts the request; the panel wires this to its Stop button. */
  signal?: AbortSignal;
}

/**
 * POSTs to a coach route and yields each event as it arrives.
 *
 * Failures before the stream opens are thrown as `ApiError`, matching every
 * other call in `client.ts`. Failures *after* it arrive as `error` events
 * instead, because by then the status line has already gone out - see the note
 * in the server's `routes/coach.ts`. Callers therefore have to read events to
 * know a turn succeeded; checking only for a thrown error is not enough.
 */
/**
 * The routes that answer with an event stream.
 *
 * Listed rather than left as `string`, so a typo is a compile error and the set
 * of streaming endpoints is readable in one place. The interview pair joined in
 * P9-1 and take a session id in the path, which is why this is a template type
 * rather than a union of literals.
 */
export type StreamPath =
  | '/api/coach/feedback'
  | '/api/coach/chat'
  | `/api/interview/${string}/say`
  | `/api/interview/${string}/finish`;

export async function* streamCoach(
  path: StreamPath,
  body: unknown,
  options: CoachStreamOptions = {},
): AsyncGenerator<CoachStreamEvent> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: 'POST',
      credentials: 'omit',
      headers: {
        [CLIENT_HEADER]: CLIENT_NAME,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      ...(options.signal ? { signal: options.signal } : {}),
    });
  } catch (error) {
    // An abort is the user pressing Stop, not a failure to report.
    if (error instanceof DOMException && error.name === 'AbortError') return;
    throw new ApiError(0, {
      error: 'Unreachable',
      message: 'The DevProMax server is not responding. Is `npm run dev` still running?',
    });
  }

  if (!response.ok) {
    const envelope = (await response.json().catch(() => ({
      error: 'Unknown',
      message: `The server answered ${response.status} with no explanation.`,
    }))) as { error: string; message: string };
    throw new ApiError(response.status, envelope);
  }

  if (response.body === null) return;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      // `stream: true` is what makes a multi-byte character split across two
      // network chunks survive; without it each half decodes to U+FFFD.
      buffer += decoder.decode(value, { stream: true });

      let boundary = MESSAGE_BOUNDARY.exec(buffer);
      while (boundary !== null) {
        const frame = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary[0].length);
        const event = parseFrame(frame);
        if (event) yield event;
        boundary = MESSAGE_BOUNDARY.exec(buffer);
      }
    }

    buffer += decoder.decode();
    const last = parseFrame(buffer);
    if (last) yield last;
  } finally {
    // Matters on the abort path: an abandoned reader holds the response open,
    // and a turn the user stopped should stop costing them immediately.
    await reader.cancel().catch(() => undefined);
  }
}

/**
 * One frame, or null.
 *
 * A frame that does not parse is skipped rather than thrown on. The stream is
 * the only channel the answer has, and killing a half-written turn over one
 * malformed frame would throw away text the user can already see.
 */
function parseFrame(frame: string): CoachStreamEvent | null {
  const data = frame
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice('data:'.length).trim())
    .join('');

  if (data === '') return null;

  try {
    const parsed = coachStreamEventSchema.safeParse(JSON.parse(data));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
