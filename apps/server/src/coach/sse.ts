/**
 * Server-sent events, only as much as Gemini's `alt=sse` responses need (P5-1).
 *
 * The Anthropic side gets this from its SDK. Gemini's streaming endpoint is a
 * plain SSE body of `data: {json}` lines, so the whole of what is needed is:
 * decode UTF-8 across chunk boundaries, split on blank lines, and parse the
 * `data:` payloads. Reaching for a dependency to do that would be buying more
 * surface than the problem has.
 *
 * Not implemented, because Gemini does not send them: event ids, `event:` types,
 * retry directives, and multi-line data folding beyond simple concatenation.
 */

/** SSE terminates a message with a blank line; both line endings are legal. */
const MESSAGE_BOUNDARY = /\r?\n\r?\n/;

/**
 * Yields each `data:` payload as a parsed JSON object.
 *
 * A payload that is not JSON is skipped rather than thrown on. Vendors send
 * keep-alive comments and the occasional `[DONE]` sentinel, and killing a
 * half-finished answer over one unparseable frame would lose the user real work.
 */
export async function* sseJsonObjects(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<Record<string, unknown>> {
  const decoder = new TextDecoder();
  const reader = body.getReader();
  let buffer = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      // `stream: true` is what makes a multi-byte character split across two
      // chunks survive; without it the halves decode to replacement characters.
      buffer += decoder.decode(value, { stream: true });

      let boundary = MESSAGE_BOUNDARY.exec(buffer);
      while (boundary !== null) {
        const message = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary[0].length);
        const parsed = parseMessage(message);
        if (parsed !== null) yield parsed;
        boundary = MESSAGE_BOUNDARY.exec(buffer);
      }
    }

    // A stream that ends without a trailing blank line still has one message in
    // hand, and it is the one carrying the end of the text.
    buffer += decoder.decode();
    const parsed = parseMessage(buffer);
    if (parsed !== null) yield parsed;
  } finally {
    // Cancelling on the way out matters on the error path: an abandoned reader
    // holds the socket open until the process notices, and a coach request the
    // user cancelled should stop costing money immediately.
    await reader.cancel().catch(() => undefined);
  }
}

function parseMessage(message: string): Record<string, unknown> | null {
  const data = message
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice('data:'.length).trim())
    .join('');

  if (data === '' || data === '[DONE]') return null;

  try {
    const value: unknown = JSON.parse(data);
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
