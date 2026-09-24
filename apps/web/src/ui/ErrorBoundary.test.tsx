import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorBoundary } from './ErrorBoundary.js';

/**
 * The boundary (ROADMAP P4-12).
 *
 * What it replaces is a blank page: before this, a lazy chunk that had gone
 * missing after a server restart unmounted the whole tree and left the answer
 * in the console.
 */

function Throwing({ message }: { message: string }): never {
  throw new Error(message);
}

beforeEach(() => {
  // React logs every caught error, and the boundary logs it again on purpose.
  // Both are expected here; what is under test is what the user sees.
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ErrorBoundary', () => {
  it('renders its children when nothing is wrong', () => {
    render(
      <ErrorBoundary title="Nothing to see.">
        <p>the real screen</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('the real screen')).toBeInTheDocument();
  });

  it('shows what broke, and the message, instead of nothing', () => {
    render(
      <ErrorBoundary title="The editor could not load.">
        <Throwing message="Failed to fetch dynamically imported module" />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('The editor could not load.');
    expect(screen.getByText(/dynamically imported module/)).toBeInTheDocument();
  });

  it('offers a reload, because that is what fixes a stale chunk', () => {
    render(
      <ErrorBoundary title="The editor could not load.">
        <Throwing message="boom" />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('button', { name: 'Reload the page' })).toBeInTheDocument();
    // Not a retry: the import would fail again the same way, and a button that
    // does nothing visible is worse than one that is honest about reloading.
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });

  it('offers the caller’s own recovery when it has one', async () => {
    const onReset = vi.fn();
    render(
      <ErrorBoundary title="That did not work." onReset={onReset}>
        <Throwing message="boom" />
      </ErrorBoundary>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onReset).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'Reload the page' })).not.toBeInTheDocument();
  });

  it('clears the error when its reset key changes, without remounting a healthy screen (P4-15)', () => {
    function Screen({ broken }: { broken: boolean }) {
      if (broken) throw new Error('boom');
      return <p>the next screen</p>;
    }

    const { rerender } = render(
      <ErrorBoundary title="This screen stopped working." resetKey="/problems/a">
        <Screen broken />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('This screen stopped working.');

    // Same key, still broken: the error stays - nothing has moved.
    rerender(
      <ErrorBoundary title="This screen stopped working." resetKey="/problems/a">
        <Screen broken={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();

    // Navigated: the boundary lets the new screen render.
    rerender(
      <ErrorBoundary title="This screen stopped working." resetKey="/progress">
        <Screen broken={false} />
      </ErrorBoundary>,
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('the next screen')).toBeInTheDocument();
  });
});
