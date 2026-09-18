import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import type { CoachFeedback, CoachStreamEvent } from '@devpromax/shared';
import { Workspace } from './Workspace.js';
import {
  aProblemDetail,
  fakeServer,
  path,
  renderApp,
  someSettings,
  type FakeServer,
} from '../../test/harness.js';

/**
 * AI Help, from the button to the rubric card (ROADMAP P5-3).
 *
 * The coach routes answer with an event stream, so the fake server hands back a
 * real `ReadableStream` of SSE frames rather than JSON. That is worth the extra
 * fixture: the client's framing, its schema check and the panel's
 * paint-as-it-arrives behaviour are the parts of P5-3 most likely to break, and
 * none of them is exercised by a response that arrives whole.
 */

/**
 * The same stand-in `Workspace.test.tsx` uses: jsdom cannot lay Monaco out, and
 * none of the behaviour under test here is Monaco's.
 */
vi.mock('../../editor/CodeEditor.js', () => ({
  default: ({ value, onChange }: { value: string; onChange: (next: string) => void }) => (
    <textarea
      aria-label="Code"
      value={value}
      onChange={(event) => {
        onChange(event.target.value);
      }}
    />
  ),
}));

const SLUG = 'pair-sum-index';
const STARTER = 'class Solution:\n    pass\n';
const ATTEMPT =
  'class Solution:\n    def pairSumIndex(self, nums, target):\n        return [0, 1]\n';

const ANSWER: CoachFeedback = {
  summary: 'Correct shape, wrong answer.',
  scores: {
    correctness: 1,
    timeComplexity: 4,
    spaceComplexity: 4,
    edgeCases: 2,
    readability: 3,
  },
  feedbackMarkdown: 'You return `[0, 1]` no matter what `nums` holds.',
  nextHintLevel: 'nudge',
  nextStep: 'Compare each value against the target.',
  mastered: false,
};

let server: FakeServer;
/** Resolves the next SSE frame, so a test can hold a turn mid-stream. */
let release: (() => void) | null = null;

/** An SSE body built from events, optionally pausing before the last one. */
function sse(events: CoachStreamEvent[], { hold = false } = {}): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const [index, event] of events.entries()) {
        const last = index === events.length - 1;
        if (hold && last) {
          await new Promise<void>((resolve) => {
            release = resolve;
          });
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
}

const START: CoachStreamEvent = {
  type: 'start',
  sessionId: '11111111-1111-4111-8111-111111111111',
};

function baseRoutes(coachResponse: () => Response) {
  return [
    { match: path(`/api/problems/${SLUG}`), body: () => aProblemDetail() },
    { match: path('/api/settings'), body: () => someSettings() },
    { match: path(`/api/drafts/${SLUG}/python`), body: () => ({ draft: null }) },
    { match: path(`/api/problems/${SLUG}/submissions`), body: () => ({ items: [] }) },
    { match: path('/api/coach/feedback'), body: coachResponse },
    { match: path('/api/coach/chat'), body: coachResponse },
  ];
}

function renderWorkspace() {
  return renderApp(
    <Routes>
      <Route path="/problems/:slug" element={<Workspace />} />
    </Routes>,
    { route: `/problems/${SLUG}` },
  );
}

beforeEach(() => {
  release = null;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Types a real attempt into the editor stand-in, so the pre-check would pass. */
async function typeAttempt(user: ReturnType<typeof userEvent.setup>) {
  const box = await screen.findByLabelText('Code');
  await user.clear(box);
  await user.click(box);
  await user.paste(ATTEMPT);
}

describe('the Coach tab', () => {
  it('explains itself before anything has been asked', async () => {
    server = fakeServer(baseRoutes(() => sse([])));
    const user = userEvent.setup();
    renderWorkspace();

    await user.click(await screen.findByRole('tab', { name: /coach/i }));

    expect(screen.getByText(/Ask for feedback on the code in the editor/i)).toBeInTheDocument();
    // The promise D13 makes, stated where the user can see it.
    expect(screen.getByText(/will not hand over the solution/i)).toBeInTheDocument();
  });

  it('streams the answer, then shows the rubric and the next step', async () => {
    server = fakeServer(
      baseRoutes(() =>
        sse([
          START,
          { type: 'markdown', delta: 'You return ' },
          { type: 'markdown', delta: '`[0, 1]` no matter what `nums` holds.' },
          { type: 'done', feedback: ANSWER },
        ]),
      ),
    );
    const user = userEvent.setup();
    renderWorkspace();

    await typeAttempt(user);
    await user.click(screen.getByRole('button', { name: 'AI Help' }));

    expect(await screen.findByText(ANSWER.summary)).toBeInTheDocument();
    expect(screen.getByText(/no matter what/)).toBeInTheDocument();
    expect(screen.getByText(ANSWER.nextStep!)).toBeInTheDocument();

    // The rubric card: five dimensions, each carrying its score in the name.
    expect(screen.getByText('Correctness')).toBeInTheDocument();
    expect(screen.getByLabelText('1 out of 4')).toBeInTheDocument();
    expect(screen.getByLabelText('3 out of 4')).toBeInTheDocument();
  });

  it('paints the prose before the scores have arrived', async () => {
    // The point of the streaming machinery: the useful half is readable while
    // the rubric is still being decided.
    server = fakeServer(
      baseRoutes(() =>
        sse(
          [
            START,
            { type: 'markdown', delta: 'You return the same pair every time.' },
            { type: 'done', feedback: ANSWER },
          ],
          { hold: true },
        ),
      ),
    );
    const user = userEvent.setup();
    renderWorkspace();

    await typeAttempt(user);
    await user.click(screen.getByRole('button', { name: 'AI Help' }));

    expect(await screen.findByText(/the same pair every time/)).toBeInTheDocument();
    expect(screen.queryByText('Correctness')).not.toBeInTheDocument();

    release?.();
    expect(await screen.findByText('Correctness')).toBeInTheDocument();
  });

  it('opens the Coach tab when AI Help is pressed from elsewhere', async () => {
    // A turn streaming into a hidden tab looks like a button that did nothing.
    server = fakeServer(baseRoutes(() => sse([START, { type: 'done', feedback: ANSWER }])));
    const user = userEvent.setup();
    renderWorkspace();

    await typeAttempt(user);
    expect(screen.getByRole('tab', { name: 'Description' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await user.click(screen.getByRole('button', { name: 'AI Help' }));

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Coach' })).toHaveAttribute('aria-selected', 'true');
    });
  });

  it('shows a local refusal as guidance, not as an error', async () => {
    server = fakeServer(
      baseRoutes(() =>
        sse([
          {
            type: 'skipped',
            reason: 'unchanged_starter',
            message: 'Write some code first, then ask for help.',
          },
        ]),
      ),
    );
    const user = userEvent.setup();
    renderWorkspace();

    await screen.findByLabelText('Code');
    await user.click(screen.getByRole('button', { name: 'AI Help' }));

    expect(await screen.findByText(/Write some code first/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('offers Settings, not a red message, when there is no key', async () => {
    server = fakeServer(
      baseRoutes(() =>
        sse([
          {
            type: 'skipped',
            reason: 'no_api_key',
            message: 'Add an Anthropic or Gemini API key in Settings to use AI Help.',
          },
        ]),
      ),
    );
    const user = userEvent.setup();
    renderWorkspace();

    await typeAttempt(user);
    await user.click(screen.getByRole('button', { name: 'AI Help' }));

    expect(await screen.findByRole('button', { name: /Open Settings/i })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('offers to retry a retryable failure, and not an unretryable one', async () => {
    server = fakeServer(
      baseRoutes(() =>
        sse([
          START,
          { type: 'error', message: 'Anthropic is rate-limiting this key.', retryable: true },
        ]),
      ),
    );
    const user = userEvent.setup();
    renderWorkspace();

    await typeAttempt(user);
    await user.click(screen.getByRole('button', { name: 'AI Help' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/rate-limiting/);
    expect(screen.getByRole('button', { name: /Try again/i })).toBeInTheDocument();
  });

  it('keeps a rejected key out of the retry path', async () => {
    server = fakeServer(
      baseRoutes(() =>
        sse([
          START,
          { type: 'error', message: 'Anthropic rejected that API key.', retryable: false },
        ]),
      ),
    );
    const user = userEvent.setup();
    renderWorkspace();

    await typeAttempt(user);
    await user.click(screen.getByRole('button', { name: 'AI Help' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/rejected/);
    expect(screen.queryByRole('button', { name: /Try again/i })).not.toBeInTheDocument();
  });

  it('sends the code currently in the editor', async () => {
    server = fakeServer(baseRoutes(() => sse([START, { type: 'done', feedback: ANSWER }])));
    const user = userEvent.setup();
    renderWorkspace();

    await typeAttempt(user);
    await user.click(screen.getByRole('button', { name: 'AI Help' }));
    await screen.findByText(ANSWER.summary);

    const call = vi.mocked(fetch).mock.calls.find(([url]) => String(url) === '/api/coach/feedback');
    const body = JSON.parse(String((call?.[1] as RequestInit).body)) as { code: string };
    expect(body.code).toContain('return [0, 1]');
    expect(body.code).not.toBe(STARTER);
  });

  it('asks for help from the keyboard', async () => {
    server = fakeServer(baseRoutes(() => sse([START, { type: 'done', feedback: ANSWER }])));
    const user = userEvent.setup();
    renderWorkspace();

    await typeAttempt(user);
    await user.keyboard('{Control>}{Shift>}H{/Shift}{/Control}');

    expect(await screen.findByText(ANSWER.summary)).toBeInTheDocument();
  });

  it('offers a follow-up only once there is a conversation to follow', async () => {
    server = fakeServer(baseRoutes(() => sse([START, { type: 'done', feedback: ANSWER }])));
    const user = userEvent.setup();
    renderWorkspace();

    await user.click(await screen.findByRole('tab', { name: /coach/i }));
    expect(screen.queryByLabelText(/follow-up/i)).not.toBeInTheDocument();

    await typeAttempt(user);
    await user.click(screen.getByRole('button', { name: 'AI Help' }));
    await screen.findByText(ANSWER.summary);

    expect(screen.getByLabelText(/follow-up/i)).toBeInTheDocument();
  });

  it('sends a follow-up against the session the first turn opened', async () => {
    server = fakeServer(baseRoutes(() => sse([START, { type: 'done', feedback: ANSWER }])));
    const user = userEvent.setup();
    renderWorkspace();

    await typeAttempt(user);
    await user.click(screen.getByRole('button', { name: 'AI Help' }));
    await screen.findByText(ANSWER.summary);

    await user.type(screen.getByLabelText(/follow-up/i), 'Why?');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url) === '/api/coach/chat')).toBe(
        true,
      );
    });

    const call = vi.mocked(fetch).mock.calls.find(([url]) => String(url) === '/api/coach/chat');
    const body = JSON.parse(String((call?.[1] as RequestInit).body)) as {
      sessionId: string;
      message: string;
    };
    expect(body).toEqual({ sessionId: START.sessionId, message: 'Why?' });
  });

  it('keeps the half-written answer when a turn is stopped', async () => {
    server = fakeServer(
      baseRoutes(() =>
        sse(
          [
            START,
            { type: 'markdown', delta: 'Half an answer.' },
            { type: 'done', feedback: ANSWER },
          ],
          { hold: true },
        ),
      ),
    );
    const user = userEvent.setup();
    renderWorkspace();

    await typeAttempt(user);
    await user.click(screen.getByRole('button', { name: 'AI Help' }));
    await screen.findByText('Half an answer.');

    await user.click(screen.getByRole('button', { name: 'Stop' }));

    // Stopping is not discarding: the text already on screen is real advice.
    expect(screen.getByText('Half an answer.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Stop' })).not.toBeInTheDocument();
    release?.();
  });

  it('never calls the coach on Run', async () => {
    // The on-demand rule (D13), asserted where it would actually be broken.
    server = fakeServer([
      ...baseRoutes(() => sse([START, { type: 'done', feedback: ANSWER }])),
      {
        match: path('/api/run'),
        body: () => ({
          slug: SLUG,
          language: 'python',
          kind: 'run',
          problemVersion: 1,
          verdict: 'WA',
          passed: 0,
          total: 1,
          totalTimeMs: 10,
          compileErrors: [],
          tests: [],
          outputTruncated: false,
          isolationFallback: false,
        }),
      },
    ]);
    const user = userEvent.setup();
    renderWorkspace();

    await typeAttempt(user);
    await user.click(screen.getByRole('button', { name: 'Run' }));

    await waitFor(() => {
      expect(server.requests.some((request) => request.url.pathname === '/api/run')).toBe(true);
    });
    expect(server.requests.some((request) => request.url.pathname.startsWith('/api/coach'))).toBe(
      false,
    );
  });
});

describe('the mastery nudge (P5-4)', () => {
  /** Adds a judge route that answers with the given verdict. */
  function withJudge(verdict: 'AC' | 'WA') {
    return {
      match: path('/api/submit'),
      body: () => ({
        slug: SLUG,
        language: 'python',
        kind: 'submit',
        problemVersion: 1,
        verdict,
        passed: verdict === 'AC' ? 1 : 0,
        total: 1,
        totalTimeMs: 12,
        compileErrors: [],
        tests: [],
        outputTruncated: false,
        isolationFallback: false,
      }),
    };
  }

  it('offers a mastery check after an accepted submit, without running one', async () => {
    server = fakeServer([
      ...baseRoutes(() => sse([START, { type: 'done', feedback: ANSWER }])),
      withJudge('AC'),
    ]);
    const user = userEvent.setup();
    renderWorkspace();

    await typeAttempt(user);
    await user.click(screen.getByRole('button', { name: 'Submit' }));

    expect(await screen.findByText(/interview-ready/i)).toBeInTheDocument();
    // D13: an accepted submit is not a request. Nothing was called.
    expect(server.requests.some((r) => r.url.pathname.startsWith('/api/coach'))).toBe(false);
  });

  it('does not offer one after a rejected submit', async () => {
    server = fakeServer([
      ...baseRoutes(() => sse([START, { type: 'done', feedback: ANSWER }])),
      withJudge('WA'),
    ]);
    const user = userEvent.setup();
    renderWorkspace();

    await typeAttempt(user);
    await user.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(server.requests.some((r) => r.url.pathname === '/api/submit')).toBe(true);
    });
    expect(screen.queryByText(/interview-ready/i)).not.toBeInTheDocument();
  });

  it('can be dismissed without asking anything', async () => {
    server = fakeServer([
      ...baseRoutes(() => sse([START, { type: 'done', feedback: ANSWER }])),
      withJudge('AC'),
    ]);
    const user = userEvent.setup();
    renderWorkspace();

    await typeAttempt(user);
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    await screen.findByText(/interview-ready/i);

    await user.click(screen.getByRole('button', { name: 'Not now' }));

    expect(screen.queryByText(/interview-ready/i)).not.toBeInTheDocument();
    expect(server.requests.some((r) => r.url.pathname.startsWith('/api/coach'))).toBe(false);
  });

  it('sends masteryCheck when the offer is taken', async () => {
    server = fakeServer([
      ...baseRoutes(() => sse([START, { type: 'done', feedback: ANSWER }])),
      withJudge('AC'),
    ]);
    const user = userEvent.setup();
    renderWorkspace();

    await typeAttempt(user);
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    await screen.findByText(/interview-ready/i);

    await user.click(screen.getByRole('button', { name: 'Check it' }));
    await screen.findByText(ANSWER.summary);

    const call = vi.mocked(fetch).mock.calls.find(([url]) => String(url) === '/api/coach/feedback');
    const body = JSON.parse(String((call?.[1] as RequestInit).body)) as { masteryCheck: boolean };
    expect(body.masteryCheck).toBe(true);
  });
});

describe('the no-key fallback (P5-6)', () => {
  const noKey: CoachStreamEvent = {
    type: 'skipped',
    reason: 'no_api_key',
    message: 'Add an Anthropic or Gemini API key in Settings to use AI Help.',
  };

  function routes() {
    return [
      ...baseRoutes(() => sse([noKey])),
      {
        match: path('/api/run'),
        body: () => ({
          slug: SLUG,
          language: 'python',
          kind: 'run',
          problemVersion: 1,
          verdict: 'WA',
          passed: 0,
          total: 3,
          totalTimeMs: 20,
          compileErrors: [],
          tests: [
            {
              index: 0,
              source: 'sample',
              verdict: 'WA',
              timeMs: 4,
              revealed: true,
              input: { args: [[1, 2], 3] },
              expected: [0, 1],
              actual: [],
              stdout: '',
              stderr: '',
            },
            {
              index: 1,
              source: 'sample',
              verdict: 'WA',
              timeMs: 4,
              revealed: true,
              input: { args: [[4, 5], 9] },
              expected: [0, 1],
              actual: [],
              stdout: '',
              stderr: '',
            },
          ],
          outputTruncated: false,
          isolationFallback: false,
        }),
      },
    ];
  }

  it('still says something useful about the last run', async () => {
    server = fakeServer(routes());
    const user = userEvent.setup();
    renderWorkspace();

    await typeAttempt(user);
    await user.click(screen.getByRole('button', { name: 'Run' }));
    await waitFor(() => {
      expect(server.requests.some((r) => r.url.pathname === '/api/run')).toBe(true);
    });

    await user.click(screen.getByRole('button', { name: 'AI Help' }));

    expect(await screen.findByText(/What the judge can tell you/i)).toBeInTheDocument();
    expect(screen.getByText(/2 of 3 tests disagreed/)).toBeInTheDocument();
    expect(screen.getByText(/same value/)).toBeInTheDocument();
    // Still offers the fix for the actual problem.
    expect(screen.getByRole('button', { name: /Open Settings/i })).toBeInTheDocument();
  });

  it('shows no fallback before anything has been run', async () => {
    server = fakeServer(routes());
    const user = userEvent.setup();
    renderWorkspace();

    await typeAttempt(user);
    await user.click(screen.getByRole('button', { name: 'AI Help' }));

    expect(await screen.findByRole('button', { name: /Open Settings/i })).toBeInTheDocument();
    expect(screen.queryByText(/What the judge can tell you/i)).not.toBeInTheDocument();
  });
});

/**
 * Turn ownership and panel state (ROADMAP P4-12).
 *
 * Both defects here are the same shape: something that belongs to *this* turn
 * or *this* panel was being reset by something else.
 */
describe('a second turn while the first is streaming', () => {
  /**
   * An SSE body that honours the abort signal, which the shared `sse` helper
   * deliberately does not.
   *
   * It has to: the defect under test *is* the first turn's abort rejection
   * running the shared `finally`. A fixture that ignored the signal would leave
   * the first turn parked forever and the test would pass either way - which is
   * how it passed against the unfixed code on the first attempt.
   */
  function abortableSse(deltas: string[], init: RequestInit | undefined): Response {
    const encoder = new TextEncoder();
    const signal = init?.signal ?? null;

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(START)}

`),
        );
        for (const delta of deltas) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'markdown', delta })}

`),
          );
        }
        // Left open: the turn ends when it is aborted or when the test does.
        signal?.addEventListener('abort', () => {
          controller.error(new DOMException('aborted', 'AbortError'));
        });
      },
    });

    return new Response(stream, {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    });
  }

  it('stays streaming, and Stop still stops it', async () => {
    // The old behaviour: the first turn's abort rejection ran the shared
    // `finally`, marked the app idle, and the second turn's text kept arriving
    // with no Stop button anywhere.
    let turns = 0;
    server = fakeServer([
      { match: path(`/api/problems/${SLUG}`), body: () => aProblemDetail() },
      { match: path('/api/settings'), body: () => someSettings() },
      { match: path(`/api/drafts/${SLUG}/python`), body: () => ({ draft: null }) },
      { match: path(`/api/problems/${SLUG}/submissions`), body: () => ({ items: [] }) },
      {
        match: path('/api/coach/feedback'),
        body: (_url, init) => {
          turns += 1;
          return abortableSse([turns === 1 ? 'First answer.' : 'Second answer.'], init);
        },
      },
    ]);

    const user = userEvent.setup();
    renderWorkspace();

    await typeAttempt(user);
    await user.click(screen.getByRole('button', { name: 'AI Help' }));
    await screen.findByText('First answer.');

    // Straight into another one. The toolbar button is disabled mid-stream,
    // but the shortcut is not - which is precisely how this was reachable.
    await user.keyboard('{Control>}{Shift>}H{/Shift}{/Control}');

    expect(await screen.findByText('Second answer.')).toBeInTheDocument();
    // The first turn's abort must not have ended the second turn's stream.
    expect(turns).toBe(2);
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Stop' }));
    expect(screen.queryByRole('button', { name: 'Stop' })).not.toBeInTheDocument();
  });
});

describe('what survives looking at another tab', () => {
  it('keeps a half-typed follow-up question', async () => {
    server = fakeServer(baseRoutes(() => sse([START, { type: 'done', feedback: ANSWER }])));
    const user = userEvent.setup();
    renderWorkspace();

    await typeAttempt(user);
    await user.click(screen.getByRole('button', { name: 'AI Help' }));
    await screen.findByText(ANSWER.summary);

    const question = screen.getByLabelText('Ask the coach a follow-up question');
    await user.type(question, 'why is that O(n log n)');

    // Radix unmounts an inactive panel, so this used to throw the question away.
    await user.click(screen.getByRole('tab', { name: 'Description' }));
    await user.click(screen.getByRole('tab', { name: 'Coach' }));

    expect(screen.getByLabelText('Ask the coach a follow-up question')).toHaveValue(
      'why is that O(n log n)',
    );
  });

  it('keeps the answer that is still arriving', async () => {
    server = fakeServer(
      baseRoutes(() =>
        sse(
          [
            START,
            { type: 'markdown', delta: 'Still writing.' },
            { type: 'done', feedback: ANSWER },
          ],
          {
            hold: true,
          },
        ),
      ),
    );
    const user = userEvent.setup();
    renderWorkspace();

    await typeAttempt(user);
    await user.click(screen.getByRole('button', { name: 'AI Help' }));
    await screen.findByText('Still writing.');

    await user.click(screen.getByRole('tab', { name: 'Description' }));
    await user.click(screen.getByRole('tab', { name: 'Coach' }));

    expect(screen.getByText('Still writing.')).toBeInTheDocument();
    release?.();
  });

  it('keeps revealed hints revealed', async () => {
    server = fakeServer(baseRoutes(() => sse([START, { type: 'done', feedback: ANSWER }])));
    const user = userEvent.setup();
    renderWorkspace();

    await user.click(await screen.findByRole('tab', { name: 'Hints' }));
    await user.click(screen.getByRole('button', { name: 'Show the first hint' }));
    expect(screen.getByText('Think about what you have already seen.')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Description' }));
    await user.click(screen.getByRole('tab', { name: 'Hints' }));

    // The count lives in the workspace now, so the ladder does not roll back up
    // when the panel is unmounted.
    expect(screen.getByText('Think about what you have already seen.')).toBeInTheDocument();
  });

  it('tells the coach how many hints have been spent', async () => {
    server = fakeServer(baseRoutes(() => sse([START, { type: 'done', feedback: ANSWER }])));
    const user = userEvent.setup();
    renderWorkspace();

    await user.click(await screen.findByRole('tab', { name: 'Hints' }));
    await user.click(screen.getByRole('button', { name: 'Show the first hint' }));

    await user.click(screen.getByRole('tab', { name: 'Description' }));
    await typeAttempt(user);
    await user.click(screen.getByRole('button', { name: 'AI Help' }));
    await screen.findByText(ANSWER.summary);

    // It must not repeat a rung the user has read; `revealedHints` was 0 on
    // every request until the count was lifted (P4-12, for P7-1).
    const call = vi.mocked(fetch).mock.calls.find(([url]) => String(url) === '/api/coach/feedback');
    const body = JSON.parse(String((call?.[1] as RequestInit).body)) as { revealedHints: number };
    expect(body.revealedHints).toBe(1);
  });
});
