import { afterEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes, useNavigate } from 'react-router-dom';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Language, ProblemDetail, RunResult, Submission } from '@devpromax/shared';
import {
  aProblemDetail,
  fakeServer,
  path,
  renderApp,
  someSettings,
  type Route as FakeRoute,
} from '../../test/harness.js';
import { Workspace } from './Workspace.js';

/**
 * The workspace (ROADMAP P4-6).
 *
 * Monaco is replaced by a textarea. It is three megabytes of editor that jsdom
 * cannot lay out, and none of the behaviour under test is Monaco's: what these
 * assertions are about is the loop around it - which code is loaded, when a
 * draft is written, what Run sends, and what Reset destroys.
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

function aRunResult(overrides: Partial<RunResult> = {}): RunResult {
  return {
    slug: SLUG,
    language: 'python',
    kind: 'run',
    problemVersion: 1,
    verdict: 'AC',
    passed: 1,
    total: 1,
    totalTimeMs: 90,
    compileErrors: [],
    tests: [
      {
        index: 0,
        source: 'sample',
        verdict: 'AC',
        timeMs: 4,
        revealed: true,
        stdout: '',
        stderr: '',
      },
    ],
    outputTruncated: false,
    isolationFallback: false,
    ...overrides,
  };
}

/**
 * The fake server keeps the problem in a `let`, which matters for P4-8: an
 * accepted submit moves the status *on the server*, and the workspace is only
 * allowed to learn about it by refetching. A route that answered with the same
 * not-started detail forever would let a header that flipped itself pass.
 */
function serve(
  detail: ProblemDetail = aProblemDetail(),
  extra: FakeRoute[] = [],
  submissions: Submission[] = [],
) {
  let current = detail;
  return fakeServer([
    ...extra,
    { match: path(`/api/problems/${SLUG}`), body: () => current },
    { match: path(`/api/problems/${SLUG}/submissions`), body: () => ({ items: submissions }) },
    {
      // Also stateful: revealing unlocks the editorial and puts the reference
      // solutions into the payload, and the answer is the whole new detail.
      match: path(`/api/problems/${SLUG}/editorial`),
      body: () => {
        current = {
          ...current,
          editorialUnlocked: true,
          editorial: current.editorial ?? '## Approach\n\nUse a hash map.',
          references: {
            python: 'def solve(nums):\n    return nums\n',
            java: 'class Solution {}\n',
          },
        };
        return current;
      },
    },
    {
      // Stateful, like the real one: the count the detail answers with has to
      // move, or "the hint is still there after a reload" cannot be tested.
      match: path(`/api/problems/${SLUG}/hints`),
      body: (_url, init) => {
        const { revealed } = JSON.parse(String(init?.body ?? '{}')) as { revealed: number };
        current = { ...current, revealedHints: Math.max(current.revealedHints, revealed) };
        return { revealed: current.revealedHints };
      },
    },
    { match: path('/api/settings'), body: () => someSettings() },
    { match: path('/api/run'), body: () => aRunResult() },
    {
      match: path('/api/submit'),
      body: () => {
        current = solvedIn('python', current);
        return aRunResult({ kind: 'submit' });
      },
    },
    {
      // Stateful too: the note the detail answers with has to move, or "it is
      // still there after a reload" cannot be tested.
      match: (url) => url.pathname.startsWith('/api/notes/'),
      body: (_url, init) => {
        const { body } = JSON.parse(String(init?.body ?? '{}')) as { body?: string };
        const note = body === undefined || body.trim() === '' ? null : body;
        current = { ...current, note, summary: { ...current.summary, hasNote: note !== null } };
        return {
          note:
            note === null
              ? null
              : { slug: SLUG, body: note, updatedAt: '2026-09-18T00:00:00.000Z' },
        };
      },
    },
    { match: (url) => url.pathname.startsWith('/api/drafts/'), body: () => ({ draft: null }) },
  ]);
}

/** The detail the API would answer with once `language` has been accepted. */
function solvedIn(language: Language, detail: ProblemDetail): ProblemDetail {
  const statusByLanguage = { ...detail.summary.statusByLanguage, [language]: 'solved' as const };
  return {
    ...detail,
    summary: {
      ...detail.summary,
      status: 'solved',
      statusByLanguage,
      solvedAt: '2026-09-17T12:00:00.000Z',
    },
  };
}

function open() {
  return renderApp(
    <Routes>
      <Route path="/problems/:slug" element={<Workspace />} />
    </Routes>,
    { route: `/problems/${SLUG}` },
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the statement panel', () => {
  it('renders the statement as markdown rather than as raw text', async () => {
    serve();
    open();

    expect(await screen.findByRole('heading', { level: 2, name: 'Input' })).toBeInTheDocument();
  });

  it('keeps the editorial locked until the problem is solved', async () => {
    serve();
    open();

    await userEvent.setup().click(await screen.findByRole('tab', { name: 'Editorial' }));
    expect(screen.getByText(/unlocks once you have solved/)).toBeInTheDocument();
  });

  it('shows an unlocked editorial', async () => {
    serve(aProblemDetail({ editorial: '## Approach\n\nUse a hash map.', editorialUnlocked: true }));
    open();

    await userEvent.setup().click(await screen.findByRole('tab', { name: 'Editorial' }));
    expect(screen.getByRole('heading', { name: 'Approach' })).toBeInTheDocument();
  });

  it('opens the lock from the inside, once the user confirms (P7-2)', async () => {
    const server = serve();
    open();

    const user = userEvent.setup();
    await user.click(await screen.findByRole('tab', { name: 'Editorial' }));
    await user.click(screen.getByRole('button', { name: 'Show it anyway' }));

    // Behind a confirmation, because it is recorded and cannot be undone.
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show it' }));

    expect(await screen.findByRole('heading', { name: 'Approach' })).toBeInTheDocument();
    expect(
      server.requests.some(
        (request) => request.method === 'POST' && request.url.pathname.endsWith('/editorial'),
      ),
    ).toBe(true);
  });

  it('records nothing when the confirmation is dismissed (P7-2)', async () => {
    const server = serve();
    open();

    const user = userEvent.setup();
    await user.click(await screen.findByRole('tab', { name: 'Editorial' }));
    await user.click(screen.getByRole('button', { name: 'Show it anyway' }));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(screen.getByText(/unlocks once you have solved/)).toBeInTheDocument();
    expect(server.requests.some((request) => request.url.pathname.endsWith('/editorial'))).toBe(
      false,
    );
  });

  it('shows the reference solution in the language being written (P7-2)', async () => {
    serve(
      aProblemDetail({
        editorial: '## Approach\n\nUse a hash map.',
        editorialUnlocked: true,
        references: { python: 'def reference_in_python():\n    pass\n', java: 'class InJava {}\n' },
      }),
    );
    open();

    const user = userEvent.setup();
    await user.click(await screen.findByRole('tab', { name: 'Editorial' }));

    // Scoped to the reference section: the workspace toolbar has its own pair
    // of language buttons reading exactly the same.
    const reference = within(screen.getByRole('region', { name: 'Reference solution' }));

    // Python is the editor's language, so it is what is shown first. Matched on
    // the identifier alone: the highlighter puts `class` in a span of its own,
    // so a query for "class InJava" spans two elements and finds neither.
    expect(screen.getByText(/reference_in_python/)).toBeInTheDocument();
    expect(screen.queryByText(/InJava/)).not.toBeInTheDocument();

    await user.click(reference.getByRole('button', { name: 'Java' }));
    expect(screen.getByText(/InJava/)).toBeInTheDocument();
  });

  it('diffs the reference against what is in the editor (P7-2)', async () => {
    serve(
      aProblemDetail({
        editorial: '## Approach\n\nUse a hash map.',
        editorialUnlocked: true,
        // The editor seeds from the starter, `class Solution:\n    pass\n`.
        references: { python: 'class Solution:\n    return 1\n', java: 'class InJava {}\n' },
      }),
    );
    open();

    const user = userEvent.setup();
    await user.click(await screen.findByRole('tab', { name: 'Editorial' }));
    await user.click(screen.getByRole('button', { name: 'Compare with my code' }));

    // One line differs; the line the two share is counted as neither.
    expect(screen.getByText('1 added')).toBeInTheDocument();
    expect(screen.getByText('1 removed')).toBeInTheDocument();
    expect(screen.getByText('class Solution:')).toBeInTheDocument();
  });

  it('says so rather than diffing the wrong language (P7-2)', async () => {
    serve(
      aProblemDetail({
        editorial: '## Approach\n\nUse a hash map.',
        editorialUnlocked: true,
        references: { python: 'p\n', java: 'j\n' },
      }),
    );
    open();

    const user = userEvent.setup();
    await user.click(await screen.findByRole('tab', { name: 'Editorial' }));
    const reference = within(screen.getByRole('region', { name: 'Reference solution' }));
    await user.click(reference.getByRole('button', { name: 'Java' }));
    await user.click(reference.getByRole('button', { name: 'Compare with my code' }));

    expect(screen.getByText(/nothing to compare the Java reference against/)).toBeInTheDocument();
  });

  it('reveals hints one rung at a time', async () => {
    serve(aProblemDetail({ hints: ['First nudge.', 'Second nudge.'] }));
    open();

    const user = userEvent.setup();
    await user.click(await screen.findByRole('tab', { name: 'Hints' }));
    expect(screen.queryByText('First nudge.')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show the first hint' }));
    expect(screen.getByText('First nudge.')).toBeInTheDocument();
    expect(screen.queryByText('Second nudge.')).not.toBeInTheDocument();
  });

  it('shows the rungs the server says were already read (P7-1)', async () => {
    serve(aProblemDetail({ hints: ['First nudge.', 'Second nudge.'], revealedHints: 1 }));
    open();

    await userEvent.setup().click(await screen.findByRole('tab', { name: 'Hints' }));

    // Revealed in an earlier sitting, so it is open before anything is clicked.
    expect(screen.getByText('First nudge.')).toBeInTheDocument();
    expect(screen.queryByText('Second nudge.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show the next hint' })).toBeInTheDocument();
  });

  it('tells the server which rung was revealed (P7-1)', async () => {
    const server = serve(aProblemDetail({ hints: ['First nudge.', 'Second nudge.'] }));
    open();

    const user = userEvent.setup();
    await user.click(await screen.findByRole('tab', { name: 'Hints' }));
    await user.click(screen.getByRole('button', { name: 'Show the first hint' }));
    await user.click(await screen.findByRole('button', { name: 'Show the next hint' }));

    // The rung, not "one more": two clicks say 1 then 2, so a request that is
    // sent twice cannot open a third hint.
    const posted = server.requests.filter(
      (request) => request.method === 'POST' && request.url.pathname.endsWith('/hints'),
    );
    expect(posted).toHaveLength(2);
    expect(posted.map((request) => request.body)).toEqual([{ revealed: 1 }, { revealed: 2 }]);
  });

  it('keeps a revealed hint across a reload (P7-1)', async () => {
    serve(aProblemDetail({ hints: ['First nudge.', 'Second nudge.'] }));
    const user = userEvent.setup();

    const first = open();
    await user.click(await screen.findByRole('tab', { name: 'Hints' }));
    await user.click(screen.getByRole('button', { name: 'Show the first hint' }));
    expect(await screen.findByText('First nudge.')).toBeInTheDocument();

    // A second mount with a fresh query client is a reload: nothing is cached,
    // the detail is read again, and the only reason the hint comes back is that
    // the server was told. P4-12 made the reveal survive a tab switch; this is
    // what P7-1 adds on top.
    first.unmount();
    open();
    await user.click(await screen.findByRole('tab', { name: 'Hints' }));

    expect(screen.getByText('First nudge.')).toBeInTheDocument();
    expect(screen.queryByText('Second nudge.')).not.toBeInTheDocument();
  });
});

describe('the submissions tab (P7-3)', () => {
  const PY_CODE = 'class Solution:\n    return 1\n';

  function aSubmission(overrides: Partial<Submission> = {}): Submission {
    return {
      id: '11111111-1111-4111-8111-111111111111',
      slug: SLUG,
      language: 'python',
      code: PY_CODE,
      verdict: 'WA',
      passed: 1,
      total: 3,
      timeMs: 12.4,
      problemVersion: 1,
      createdAt: '2026-09-17T10:00:00.000Z',
      ...overrides,
    };
  }

  /**
   * Scoped to the list: the bottom panel's collapse toggle also carries
   * `aria-expanded`, so a bare query for an expanded button finds two.
   */
  async function openSubmissions(submissions: Submission[]) {
    serve(aProblemDetail(), [], submissions);
    open();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('tab', { name: /Submissions/ }));
    return {
      user,
      list: within(await screen.findByRole('list', { name: /Submissions for this problem/ })),
    };
  }

  it('opens a row to show what was submitted', async () => {
    const { user, list } = await openSubmissions([aSubmission()]);

    const row = list.getByRole('button', { expanded: false });
    await user.click(row);

    expect(list.getByRole('button', { expanded: true })).toBeInTheDocument();
    expect(list.getByText('v1')).toBeInTheDocument();
    expect(screen.getByText(/12 ms/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restore into the editor' })).toBeInTheDocument();
  });

  it('closes it again when the same row is clicked', async () => {
    const { user, list } = await openSubmissions([aSubmission()]);

    await user.click(list.getByRole('button', { expanded: false }));
    await user.click(list.getByRole('button', { expanded: true }));

    expect(
      screen.queryByRole('button', { name: 'Restore into the editor' }),
    ).not.toBeInTheDocument();
  });

  it('diffs the attempt against the editor', async () => {
    // The editor holds the starter, `class Solution:\n    pass\n`.
    const { user, list } = await openSubmissions([aSubmission()]);

    await user.click(list.getByRole('button', { expanded: false }));
    await user.click(screen.getByRole('button', { name: 'Compare with my code' }));

    expect(screen.getByText('1 added')).toBeInTheDocument();
    expect(screen.getByText('1 removed')).toBeInTheDocument();
  });

  it('restores it into the editor, behind a confirmation', async () => {
    const { user, list } = await openSubmissions([aSubmission()]);

    await user.click(list.getByRole('button', { expanded: false }));
    await user.click(screen.getByRole('button', { name: 'Restore into the editor' }));

    // There is work in the editor to lose - the starter counts as work the
    // moment it is not what is being restored.
    await user.click(await screen.findByRole('button', { name: 'Restore' }));

    expect(await screen.findByLabelText('Code')).toHaveValue(PY_CODE);
  });

  it('brings the language with it when the attempt is in the other one', async () => {
    const { user, list } = await openSubmissions([
      aSubmission({ language: 'java', code: 'class Solution { int f() { return 1; } }' }),
    ]);

    await user.click(list.getByRole('button', { expanded: false }));
    // The button says what it is about to do, because switching the editor's
    // language is not what "restore" sounds like.
    await user.click(screen.getByRole('button', { name: 'Restore, and switch to Java' }));
    await user.click(await screen.findByRole('button', { name: 'Restore' }));

    expect(await screen.findByLabelText('Code')).toHaveValue(
      'class Solution { int f() { return 1; } }',
    );
    // And the tab does not bounce back to the description on the way (P7-3).
    expect(screen.getByRole('tab', { name: /Submissions/, selected: true })).toBeInTheDocument();
  });

  it('will not pretend to diff two different languages', async () => {
    const { user, list } = await openSubmissions([
      aSubmission({ language: 'java', code: 'class S {}' }),
    ]);

    await user.click(list.getByRole('button', { expanded: false }));
    await user.click(screen.getByRole('button', { name: 'Compare with my code' }));

    expect(screen.getByText(/nothing line-for-line to compare/)).toBeInTheDocument();
  });
});

describe('the notes tab (P7-4)', () => {
  it('autosaves what is typed, and does not save what is not', async () => {
    const server = serve();
    open();

    const user = userEvent.setup();
    await user.click(await screen.findByRole('tab', { name: 'Notes' }));

    // Nothing typed, nothing written: opening the tab is not an edit.
    expect(server.requests.some((request) => request.url.pathname.startsWith('/api/notes/'))).toBe(
      false,
    );

    await user.type(screen.getByLabelText('Your notes on this problem'), 'the window shrinks left');

    await waitFor(() => {
      const written = server.requests.filter((request) =>
        request.url.pathname.startsWith('/api/notes/'),
      );
      expect(written.at(-1)?.body).toEqual({ body: 'the window shrinks left' });
    });
  });

  it('writes the last few keystrokes on the way out rather than dropping them', async () => {
    const server = serve();
    const first = open();

    const user = userEvent.setup();
    await user.click(await screen.findByRole('tab', { name: 'Notes' }));
    await user.type(screen.getByLabelText('Your notes on this problem'), 'half a thought');

    // Leaving immediately, inside the debounce. Before the flush, this was the
    // sentence that vanished.
    first.unmount();

    await waitFor(() => {
      const written = server.requests.filter((request) =>
        request.url.pathname.startsWith('/api/notes/'),
      );
      expect(written.at(-1)?.body).toEqual({ body: 'half a thought' });
    });
  });

  it('keeps what was typed when another tab is looked at', async () => {
    serve();
    open();

    const user = userEvent.setup();
    await user.click(await screen.findByRole('tab', { name: 'Notes' }));
    await user.type(screen.getByLabelText('Your notes on this problem'), 'mid-sentence');

    // Radix unmounts an inactive panel, which used to throw away everything
    // half-typed in it (P4-12). The notes panel is kept mounted for that.
    await user.click(screen.getByRole('tab', { name: 'Description' }));
    await user.click(screen.getByRole('tab', { name: 'Notes' }));

    expect(screen.getByLabelText('Your notes on this problem')).toHaveValue('mid-sentence');
  });

  it('renders the note as markdown in the preview', async () => {
    serve(aProblemDetail({ note: '## What I missed\n\nThe empty case.' }));
    open();

    const user = userEvent.setup();
    await user.click(await screen.findByRole('tab', { name: 'Notes' }));
    expect(screen.getByLabelText('Your notes on this problem')).toHaveValue(
      '## What I missed\n\nThe empty case.',
    );

    await user.click(screen.getByRole('button', { name: 'Preview' }));
    expect(screen.getByRole('heading', { name: 'What I missed' })).toBeInTheDocument();
  });
});

describe('the editor', () => {
  it('starts from the starter when there is no draft', async () => {
    serve();
    open();

    expect(await screen.findByLabelText('Code')).toHaveValue('class Solution:\n    pass\n');
  });

  it('starts from the draft when there is one', async () => {
    serve(
      aProblemDetail({
        drafts: {
          python: {
            slug: SLUG,
            language: 'python',
            code: 'half an answer',
            updatedAt: '2026-09-17T09:00:00.000Z',
          },
        },
      }),
    );
    open();

    expect(await screen.findByLabelText('Code')).toHaveValue('half an answer');
  });

  it('autosaves a draft after the typing stops', async () => {
    const server = serve();
    open();
    const code = await screen.findByLabelText('Code');

    await userEvent.setup().type(code, 'x');

    await waitFor(
      () => {
        expect(
          server.requests.some(
            (request) => request.method === 'PUT' && request.url.pathname.includes('/api/drafts/'),
          ),
        ).toBe(true);
      },
      { timeout: 3000 },
    );
  });
});

describe('reset to the starter', () => {
  it('asks first, and deletes the draft when confirmed', async () => {
    const server = serve(
      aProblemDetail({
        drafts: {
          python: {
            slug: SLUG,
            language: 'python',
            code: 'half an answer',
            updatedAt: '2026-09-17T09:00:00.000Z',
          },
        },
      }),
    );
    open();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Reset' }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reset', hidden: false }));
    await waitFor(() => {
      expect(screen.getByLabelText('Code')).toHaveValue('class Solution:\n    pass\n');
    });
    expect(
      server.requests.some(
        (request) => request.method === 'DELETE' && request.url.pathname.includes('/api/drafts/'),
      ),
    ).toBe(true);
  });

  it('changes nothing when cancelled', async () => {
    serve(
      aProblemDetail({
        drafts: {
          python: {
            slug: SLUG,
            language: 'python',
            code: 'half an answer',
            updatedAt: '2026-09-17T09:00:00.000Z',
          },
        },
      }),
    );
    open();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Reset' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByLabelText('Code')).toHaveValue('half an answer');
  });
});

describe('running and submitting', () => {
  async function press(code: string, shift: boolean) {
    const user = userEvent.setup();
    await user.keyboard(
      shift ? `{Control>}{Shift>}[${code}]{/Shift}{/Control}` : `{Control>}[${code}]{/Control}`,
    );
  }

  it('runs on Ctrl+Enter', async () => {
    const server = serve();
    open();
    await screen.findByLabelText('Code');

    await press('Enter', false);
    await waitFor(() => {
      expect(server.requests.some((request) => request.url.pathname === '/api/run')).toBe(true);
    });
    expect(server.requests.some((request) => request.url.pathname === '/api/submit')).toBe(false);
  });

  it('submits on Ctrl+Shift+Enter', async () => {
    const server = serve();
    open();
    await screen.findByLabelText('Code');

    await press('Enter', true);
    await waitFor(() => {
      expect(server.requests.some((request) => request.url.pathname === '/api/submit')).toBe(true);
    });
  });

  it('shows the results tab once a run comes back', async () => {
    serve();
    open();
    await screen.findByLabelText('Code');

    await userEvent.setup().click(screen.getByRole('button', { name: 'Run' }));
    expect(await screen.findByTestId('verdict')).toHaveTextContent('Accepted');
  });
});

describe('the bottom panel', () => {
  it('collapses and expands on Ctrl+J', async () => {
    serve();
    open();
    await screen.findByLabelText('Code');
    const user = userEvent.setup();

    expect(screen.getByRole('tab', { name: 'Testcases' })).toBeInTheDocument();
    expect(screen.getByText('Samples')).toBeInTheDocument();

    await user.keyboard('{Control>}[KeyJ]{/Control}');
    await waitFor(() => {
      expect(screen.queryByText('Samples')).not.toBeInTheDocument();
    });
    // The tab strip stays, so there is something to click to bring it back.
    expect(screen.getByRole('tab', { name: 'Testcases' })).toBeInTheDocument();

    await user.keyboard('{Control>}[KeyJ]{/Control}');
    await waitFor(() => {
      expect(screen.getByText('Samples')).toBeInTheDocument();
    });
  });
});

describe('live status propagation (P4-8)', () => {
  it('flips the header to Solved once the server says so, and announces it', async () => {
    serve();
    open();
    await screen.findByLabelText('Code');

    // Nothing claimed before anything has been submitted.
    const readout = screen.getByTestId('problem-status');
    expect(readout).toBeEmptyDOMElement();
    expect(readout).toHaveAttribute('role', 'status');

    await userEvent.setup().click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(readout).toHaveTextContent('Solved in Python');
    });
  });

  it('says so on arrival for a problem solved in an earlier session', async () => {
    serve(solvedIn('python', aProblemDetail()));
    open();

    expect(await screen.findByTestId('problem-status')).toHaveTextContent('Solved in Python');
  });

  it('reports the language being edited, not the best of them', async () => {
    serve(solvedIn('python', aProblemDetail()));
    open();
    await screen.findByLabelText('Code');

    await userEvent.setup().click(screen.getByRole('button', { name: 'Java' }));

    // The problem is solved; this language is not, and a header that said
    // "Solved" over an empty Java editor would be lying about the thing on
    // screen.
    await waitFor(() => {
      expect(screen.getByTestId('problem-status')).toBeEmptyDOMElement();
    });
  });
});

/**
 * Draft integrity (ROADMAP P4-11).
 *
 * Every test here is a way the audit found of losing work the editor claimed
 * was saved. They are written against the round trip rather than against the
 * request, because "the PUT was sent" was already true while the draft was
 * being lost: what was wrong was what the app believed afterwards.
 */
describe('draft integrity', () => {
  /** A drafts route that behaves like the real one: PUT echoes, DELETE clears. */
  function draftRoute(): FakeRoute {
    return {
      match: (url) => url.pathname.startsWith('/api/drafts/'),
      body: (url, init) => {
        if (init?.method === 'DELETE') return { draft: null };
        const code = (JSON.parse(String(init?.body ?? '{}')) as { code?: string }).code ?? '';
        const language = url.pathname.split('/').pop() as Language;
        return {
          draft: { slug: SLUG, language, code, updatedAt: '2026-09-17T10:00:00.000Z' },
        };
      },
    };
  }

  function serveWithDrafts(detail: ProblemDetail = aProblemDetail()) {
    const server = serve(detail, [draftRoute()]);
    return server;
  }

  it('survives switching language twice', async () => {
    serveWithDrafts();
    open();
    const user = userEvent.setup();

    const code = await screen.findByLabelText('Code');
    await user.clear(code);
    await user.type(code, 'my python answer');

    // Away and back. The editor is re-seeded from the cached problem each time,
    // so before the write-through this restored the starter - and the next
    // autosave wrote that starter over the real draft.
    await user.click(screen.getByRole('button', { name: 'Java' }));
    expect(await screen.findByLabelText('Code')).toHaveValue('class Solution {}\n');

    await user.click(screen.getByRole('button', { name: 'Python' }));
    await waitFor(() => {
      expect(screen.getByLabelText('Code')).toHaveValue('my python answer');
    });
  });

  it('flushes what was typed a moment before the language changed', async () => {
    const server = serveWithDrafts();
    open();
    const user = userEvent.setup();

    const code = await screen.findByLabelText('Code');
    await user.clear(code);
    await user.type(code, 'typed and left');
    // Immediately - well inside the 800 ms debounce, which used to be cleared
    // without being flushed.
    await user.click(screen.getByRole('button', { name: 'Java' }));

    await waitFor(() => {
      const put = server.requests.find(
        (request) => request.method === 'PUT' && request.url.pathname.endsWith('/python'),
      );
      expect(put).toBeDefined();
    });
  });

  it('locks the other language while the judge is working', async () => {
    // The switch itself is the fix: a run in flight belongs to the language
    // that started it, and switching mid-run leaves the user in front of one
    // editor waiting for the other one's verdict.
    let release: (() => void) | undefined;
    const held: FakeRoute = {
      match: path('/api/run'),
      body: () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              release = () => {
                controller.enqueue(new TextEncoder().encode(JSON.stringify(aRunResult())));
                controller.close();
              };
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    };

    serve(aProblemDetail(), [held, draftRoute()]);
    open();
    const user = userEvent.setup();

    await screen.findByLabelText('Code');
    await user.click(screen.getByRole('button', { name: 'Run' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Java' })).toBeDisabled();
    });

    release?.();

    // Released, the verdict lands as usual and the switch is available again.
    expect(await screen.findByText('Accepted')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Java' })).toBeEnabled();
  });

  it('drops a verdict that arrives after the user opened another problem', async () => {
    const OTHER = 'shift-right-in-place';
    let release: (() => void) | undefined;

    const held: FakeRoute = {
      match: path('/api/run'),
      body: () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              release = () => {
                controller.enqueue(new TextEncoder().encode(JSON.stringify(aRunResult())));
                controller.close();
              };
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    };

    const other = aProblemDetail({
      summary: { ...aProblemDetail().summary, slug: OTHER, title: 'Shift Right In Place' },
    });

    serve(aProblemDetail(), [
      held,
      draftRoute(),
      { match: path(`/api/problems/${OTHER}`), body: () => other },
      { match: path(`/api/problems/${OTHER}/submissions`), body: () => ({ items: [] }) },
    ]);

    renderApp(
      <>
        <Elsewhere to={`/problems/${OTHER}`} />
        <Routes>
          <Route path="/problems/:slug" element={<Workspace />} />
        </Routes>
      </>,
      { route: `/problems/${SLUG}` },
    );

    const user = userEvent.setup();
    await screen.findByLabelText('Code');
    await user.click(screen.getByRole('button', { name: 'Run' }));

    // The route changes without unmounting the workspace - same component, new
    // slug - and then the first problem's verdict arrives.
    await user.click(screen.getByRole('button', { name: 'open the other problem' }));
    await screen.findByRole('heading', { name: 'Shift Right In Place' });
    release?.();

    // It is not shown: a verdict about code that is no longer on screen would
    // be read as a verdict about the code that is (P4-11).
    await waitFor(() => {
      expect(screen.queryByText('Accepted')).not.toBeInTheDocument();
    });
  });
});

/** A link out of the workspace, for the stale-result test. */
function Elsewhere({ to }: { to: string }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => {
        void navigate(to);
      }}
    >
      open the other problem
    </button>
  );
}
