import { describe, expect, it } from 'vitest';
import { sseJsonObjects } from './sse.js';

/**
 * The SSE reader (ROADMAP P5-1).
 *
 * Same theme as the partial-string tests: the interesting cases are all about
 * where the stream happens to be cut. A frame split across two network chunks,
 * a multi-byte character split across two network chunks, and a body that ends
 * without its final blank line are the three ways a naive reader loses text.
 */

/** Feeds the given byte groups through as separate stream chunks. */
function streamOf(...chunks: (string | Uint8Array)[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(typeof chunk === 'string' ? encoder.encode(chunk) : chunk);
      }
      controller.close();
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  for await (const value of sseJsonObjects(stream)) out.push(value);
  return out;
}

describe('sseJsonObjects', () => {
  it('reads the frames of a well-formed body', async () => {
    const body = streamOf('data: {"n":1}\n\ndata: {"n":2}\n\n');
    expect(await collect(body)).toEqual([{ n: 1 }, { n: 2 }]);
  });

  it('reassembles a frame split across chunks', async () => {
    const body = streamOf('data: {"te', 'xt":"hel', 'lo"}\n\n');
    expect(await collect(body)).toEqual([{ text: 'hello' }]);
  });

  it('yields the last frame even without a trailing blank line', async () => {
    const body = streamOf('data: {"n":1}\n\ndata: {"n":2}');
    expect(await collect(body)).toEqual([{ n: 1 }, { n: 2 }]);
  });

  it('survives a multi-byte character split across chunks', async () => {
    // "é" is two bytes; the split puts one in each chunk, which is exactly what
    // a decoder without `stream: true` turns into replacement characters.
    const bytes = new TextEncoder().encode('data: {"text":"é"}\n\n');
    const body = streamOf(bytes.slice(0, 16), bytes.slice(16));
    expect(await collect(body)).toEqual([{ text: 'é' }]);
  });

  it('accepts CRLF line endings', async () => {
    const body = streamOf('data: {"n":1}\r\n\r\n');
    expect(await collect(body)).toEqual([{ n: 1 }]);
  });

  it('skips keep-alives, comments and the DONE sentinel', async () => {
    const body = streamOf(': keep-alive\n\ndata: {"n":1}\n\ndata: [DONE]\n\n');
    expect(await collect(body)).toEqual([{ n: 1 }]);
  });

  it('skips an unparseable frame instead of losing the rest of the answer', async () => {
    const body = streamOf('data: {not json}\n\ndata: {"n":2}\n\n');
    expect(await collect(body)).toEqual([{ n: 2 }]);
  });

  it('joins a frame whose data is folded across several lines', async () => {
    const body = streamOf('data: {"n":\ndata: 1}\n\n');
    expect(await collect(body)).toEqual([{ n: 1 }]);
  });

  it('cancels the body when the consumer stops early', async () => {
    // Left open on purpose: this is the case that matters, a response still
    // arriving when the user cancels. An abandoned reader on a live socket
    // keeps a coach request the user stopped costing money.
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"n":1}\n\ndata: {"n":2}\n\n'));
      },
      cancel() {
        cancelled = true;
      },
    });

    for await (const _ of sseJsonObjects(body)) break;

    expect(cancelled).toBe(true);
  });
});
