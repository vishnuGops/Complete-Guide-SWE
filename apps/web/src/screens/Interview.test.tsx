import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CoachStreamEvent, Interview as Sitting } from '@devpromax/shared';
import { Interview } from './Interview.js';
import { fakeServer, path, renderApp } from '../test/harness.js';

/**
 * The mock interview screen (ROADMAP P9-1).
 *
 * What is worth testing here is the shape of the sitting rather than the
 * conversation: that it opens on the approach, that the button says what comes
 * next, and that a debrief is readable after the clock has stopped. The
 * interviewer's answers come through the same stream the Coach panel uses,
 * which `coach.spec.ts` already drives end to end.
 */

function aSitting(overrides: Partial<Sitting> = {}): Sitting {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    problems: [
      {
        slug: 'pair-sum-index',
        title: 'Pair Sum Index',
        topic: 'arrays',
        tier: 'Easy',
        rating: 2,
        attempted: false,
        solved: false,
      },
      {
        slug: 'course-order',
        title: 'An Order That Works',
        topic: 'graph',
        tier: 'Medium',
        rating: 6,
        attempted: false,
        solved: false,
      },
    ],
    budgetMs: 45 * 60 * 1000,
    at: 0,
    stage: 'approach',
    sessionId: null,
    debrief: null,
    createdAt: new Date().toISOString(),
    endedAt: null,
    remainingMs: 45 * 60 * 1000,
    transcript: [],
    ...overrides,
  };
}

/** An SSE body, the shape `streamCoach` reads. */
function sse(events: CoachStreamEvent[]): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const event of events) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}

`),
          );
        }
        controller.close();
      },
    }),
    { status: 200, headers: { 'content-type': 'text/event-stream' } },
  );
}

/**
 * A turn that stays open until the test lets the reply through, so what the
 * screen does *while* the interviewer answers can be looked at.
 */
function heldTurn(reply: string) {
  const encoder = new TextEncoder();
  let release = (): void => undefined;
  const response = () =>
    new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          release = () => {
            const events: CoachStreamEvent[] = [
              { type: 'markdown', delta: reply },
              { type: 'reply', content: reply },
            ];
            for (const event of events) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(event)}

`),
              );
            }
            controller.close();
          };
        },
      }),
      { status: 200, headers: { 'content-type': 'text/event-stream' } },
    );
  return {
    response,
    release: () => {
      release();
    },
  };
}

function serve(interview: Sitting | null, turn: CoachStreamEvent[] | (() => Response) = []) {
  let current = interview;
  return fakeServer([
    {
      match: path('/api/interview'),
      body: (_url, init) => {
        if (init?.method === 'POST') {
          current = aSitting();
          return current;
        }
        return { interview: current };
      },
    },
    {
      match: (url) => url.pathname.endsWith('/advance'),
      body: () => {
        current = current ? { ...current, stage: 'coding' } : null;
        return current;
      },
    },
    {
      match: (url) => url.pathname.endsWith('/say'),
      body: () => (typeof turn === 'function' ? turn() : sse(turn)),
    },
    {
      match: (url) => url.pathname.endsWith('/finish'),
      body: () => {
        // The server ends the sitting whether or not a debrief arrived.
        current = current ? { ...current, stage: 'done', endedAt: new Date().toISOString() } : null;
        return typeof turn === 'function' ? turn() : sse(turn);
      },
    },
  ]);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the interview screen', () => {
  it('explains the format before anything starts', async () => {
    serve(null);
    renderApp(<Interview />);

    expect(await screen.findByRole('button', { name: 'Start an interview' })).toBeInTheDocument();
    // The one thing someone has to know before agreeing to it.
    expect(screen.getByText(/will not give you the answer/)).toBeInTheDocument();
  });

  it('opens on the approach, with both problems listed', async () => {
    serve(null);
    renderApp(<Interview />);

    await userEvent
      .setup()
      .click(await screen.findByRole('button', { name: 'Start an interview' }));

    expect(await screen.findByRole('link', { name: 'Pair Sum Index' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'An Order That Works' })).toBeInTheDocument();
    // Approach before code: the ordering is the feature.
    expect(
      screen.getByText(/say how you would solve it - in words, before any code/),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'I am ready to write it' })).toBeInTheDocument();
  });

  it('shows the clock, and says how long is left', async () => {
    serve(aSitting({ remainingMs: 12 * 60 * 1000 }));
    renderApp(<Interview />);

    const clock = await screen.findByRole('timer');
    expect(clock).toHaveAccessibleName('Time remaining');
    expect(clock).toHaveTextContent(/^1[12]:\d\d$/);
  });

  it('moves the instruction on when the candidate is ready to write', async () => {
    serve(aSitting());
    renderApp(<Interview />);

    await userEvent
      .setup()
      .click(await screen.findByRole('button', { name: 'I am ready to write it' }));

    expect(await screen.findByText(/Write it\./)).toBeInTheDocument();
  });

  it('marks what has been submitted so far', async () => {
    serve(
      aSitting({
        problems: [
          {
            slug: 'pair-sum-index',
            title: 'Pair Sum Index',
            topic: 'arrays',
            tier: 'Easy',
            rating: 2,
            attempted: true,
            solved: true,
          },
          {
            slug: 'course-order',
            title: 'An Order That Works',
            topic: 'graph',
            tier: 'Medium',
            rating: 6,
            attempted: true,
            solved: false,
          },
        ],
      }),
    );
    renderApp(<Interview />);

    expect(await screen.findByText('accepted')).toBeInTheDocument();
    expect(screen.getByText('submitted')).toBeInTheDocument();
  });

  it('reads the debrief back after the clock has stopped', async () => {
    serve(
      aSitting({
        stage: 'done',
        endedAt: new Date().toISOString(),
        remainingMs: 0,
        debrief: '## How it went\n\nYou coded before you explained.',
      }),
    );
    renderApp(<Interview />);

    expect(await screen.findByRole('heading', { name: 'How it went' })).toBeInTheDocument();
    // And the way to have another go is on the same screen.
    expect(screen.getByRole('button', { name: 'Start an interview' })).toBeInTheDocument();
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
  });

  it('puts what was said, and what came back, in the transcript', async () => {
    serve(aSitting(), [
      { type: 'start', sessionId: '22222222-2222-4222-8222-222222222222' },
      { type: 'markdown', delta: 'Why a hash map?' },
      { type: 'reply', content: 'Why a hash map?' },
    ]);
    renderApp(<Interview />);

    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('What you would say'), 'I would use a hash map.');
    await user.click(screen.getByRole('button', { name: 'Say it' }));

    expect(await screen.findByText('Why a hash map?')).toBeInTheDocument();
    expect(screen.getByText('I would use a hash map.')).toBeInTheDocument();
    // And the box is empty again, ready for the answer.
    expect(await screen.findByLabelText('What you would say')).toHaveValue('');
  });

  it('still says why when the interview ends without a debrief', async () => {
    // Ending with no key ends the sitting all the same, and the screen it
    // switches to is the one that has to carry the explanation.
    serve(aSitting(), [{ type: 'skipped', reason: 'no_api_key', message: 'No key.' }]);
    renderApp(<Interview />);

    await userEvent
      .setup()
      .click(await screen.findByRole('button', { name: 'End it and get the debrief' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('needs an API key');
    expect(screen.getByRole('button', { name: 'Start an interview' })).toBeInTheDocument();
  });

  it('says why it could not start rather than doing nothing', async () => {
    fakeServer([
      {
        match: path('/api/interview'),
        body: (_url, init) => {
          if (init?.method !== 'POST') return { interview: null };
          return new Response(
            JSON.stringify({
              error: 'BadRequest',
              message: 'A mock interview needs two unsolved problems.',
            }),
            { status: 400, headers: { 'content-type': 'application/json' } },
          );
        },
      },
    ]);
    renderApp(<Interview />);

    await userEvent
      .setup()
      .click(await screen.findByRole('button', { name: 'Start an interview' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('two unsolved problems');
    });
  });

  it('counts down from when the answer arrived, not from when the sitting began', async () => {
    // Twenty minutes in: the server has already taken them off `remainingMs`,
    // and taking them off again showed 5:00 (P4-16).
    serve(
      aSitting({
        createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
        remainingMs: 25 * 60 * 1000,
      }),
    );
    renderApp(<Interview />);

    expect(await screen.findByRole('timer')).toHaveTextContent(/^(25:00|24:5\d)$/);
  });

  it('picks the conversation up where it was left', async () => {
    // Leaving for the workspace to write the code is the normal case, and
    // coming back must not start the conversation over (P4-16).
    serve(
      aSitting({
        sessionId: '22222222-2222-4222-8222-222222222222',
        transcript: [
          { from: 'you', text: 'I would sort it first.' },
          { from: 'them', text: 'What does the sort cost you?' },
        ],
      }),
    );
    renderApp(<Interview />);

    expect(await screen.findByText('What does the sort cost you?')).toBeInTheDocument();
    expect(screen.getByText('I would sort it first.')).toBeInTheDocument();
    expect(screen.queryByText(/Nothing said yet/)).not.toBeInTheDocument();
  });

  it('abandons a turn still streaming when the screen goes away', async () => {
    const held = heldTurn('Never read.');
    serve(aSitting(), held.response);
    const { unmount } = renderApp(<Interview />);

    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('What you would say'), 'A hash map.');
    await user.click(screen.getByRole('button', { name: 'Say it' }));
    await screen.findByRole('button', { name: 'Listening…' });

    const call = vi.mocked(fetch).mock.calls.find(([input]) => String(input).endsWith('/say'));
    const signal = call?.[1]?.signal;
    expect(signal?.aborted).toBe(false);

    unmount();
    expect(signal?.aborted).toBe(true);
  });

  it('offers only the end once both problems are done', async () => {
    // Past the last problem there is no stage to move on to (P4-16).
    serve(aSitting({ at: 2, stage: 'debrief' }));
    renderApp(<Interview />);

    const end = await screen.findAllByRole('button', { name: 'End it and get the debrief' });
    expect(end).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Move on' })).not.toBeInTheDocument();
  });

  it('keeps the box, read-only and focused, while the interviewer answers', async () => {
    const held = heldTurn('Why two pointers?');
    serve(aSitting(), held.response);
    renderApp(<Interview />);

    const user = userEvent.setup();
    const box = await screen.findByLabelText('What you would say');
    await user.type(box, 'Sort, then two pointers.');
    await user.click(screen.getByRole('button', { name: 'Say it' }));

    // Disabled would have dropped focus to the page (P4-16).
    await waitFor(() => {
      expect(box).toHaveAttribute('readonly');
    });
    expect(box).toHaveAttribute('aria-disabled', 'true');
    expect(box).toHaveFocus();

    held.release();
    expect(await screen.findByText('Why two pointers?')).toBeInTheDocument();
    await waitFor(() => {
      expect(box).not.toHaveAttribute('readonly');
    });
    expect(box).toHaveFocus();
  });
});
