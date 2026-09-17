import { afterEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Language, ProblemDetail, RunResult } from '@devpromax/shared';
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
function serve(detail: ProblemDetail = aProblemDetail(), extra: FakeRoute[] = []) {
  let current = detail;
  return fakeServer([
    ...extra,
    { match: path(`/api/problems/${SLUG}`), body: () => current },
    { match: path(`/api/problems/${SLUG}/submissions`), body: () => ({ items: [] }) },
    { match: path('/api/settings'), body: () => someSettings() },
    { match: path('/api/run'), body: () => aRunResult() },
    {
      match: path('/api/submit'),
      body: () => {
        current = solvedIn('python', current);
        return aRunResult({ kind: 'submit' });
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
