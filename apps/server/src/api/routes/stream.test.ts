import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FastifyReply } from 'fastify';
import type { CoachStreamEvent } from '@devpromax/shared';
import { logger } from '../../logger.js';
import { streamEvents } from './stream.js';

/**
 * Cancelling a stream (ROADMAP P3-10).
 *
 * The socket closing calls the generator's `return()`, and nothing awaits the
 * promise that comes back. If the generator's own clean-up throws, that promise
 * rejects - and an unhandled rejection ends the Node process, so one closed tab
 * could stop the server for everyone.
 */

afterEach(() => {
  vi.restoreAllMocks();
});

/** Just enough of a Fastify reply for `streamEvents`: a raw socket and hijack. */
function fakeReply() {
  const raw = Object.assign(new EventEmitter(), {
    headersSent: false,
    frames: [] as string[],
    writeHead() {
      raw.headersSent = true;
    },
    write(chunk: string) {
      raw.frames.push(chunk);
    },
    end() {},
  });
  const reply = { raw, sent: false, hijack() {}, code() {} };
  return { raw, reply: reply as unknown as FastifyReply };
}

const delta: CoachStreamEvent = { type: 'markdown', delta: 'thinking' };

describe('streamEvents', () => {
  it('catches a clean-up that throws when the socket closes mid-stream', async () => {
    const errors = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    const { raw, reply } = fakeReply();

    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const done = streamEvents(reply, async function* () {
      try {
        yield delta;
        await gate;
        yield delta;
      } finally {
        // The kind of failure a real clean-up can hit: recording the cost of
        // a cancelled turn against a database that has gone away.
        // eslint-disable-next-line no-unsafe-finally -- the throw is the subject of this test
        throw new Error('could not record the cancelled turn');
      }
    });

    // Let the first frame out, then close the socket while the second is pending.
    await vi.waitFor(() => {
      expect(raw.frames).toHaveLength(1);
    });
    raw.emit('close');
    release();

    await done.catch(() => undefined);
    await vi.waitFor(() => {
      expect(errors).toHaveBeenCalledWith(expect.anything(), 'cancelling a stream failed');
    });
  });
});
