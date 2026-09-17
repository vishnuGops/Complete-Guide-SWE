import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorState } from './ErrorState.js';
import { Loading, Skeleton } from './Loading.js';

/**
 * The loading and error states (ROADMAP P4-10).
 *
 * What is worth pinning here is what each one says to a screen reader, because
 * that is the half nobody sees change: a wall of grey blocks announced as
 * twenty empty regions, or an error that never interrupts, both look perfectly
 * correct in a screenshot.
 */

describe('Loading', () => {
  it('announces what is being waited for, and not the blocks', () => {
    render(
      <Loading label="Loading problems">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-20" />
      </Loading>,
    );

    // A live region is announced by its contents rather than by a name, so the
    // contents are what the assertion is about: the label, and nothing else.
    // The placeholders are decoration and are hidden from the tree entirely.
    const region = screen.getByRole('status');
    expect(region).toHaveTextContent('Loading problems');
    expect(region).toHaveAttribute('aria-busy', 'true');
    expect(region.querySelectorAll('[aria-hidden="true"]')).toHaveLength(3);
  });
});

describe('ErrorState', () => {
  it('interrupts, says what failed and what the server said', () => {
    render(
      <ErrorState title="The problem list could not load." error={new Error('fetch failed')} />,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('The problem list could not load.');
    expect(alert).toHaveTextContent('fetch failed');
  });

  it('offers a retry only when there is something to retry', async () => {
    const onRetry = vi.fn();
    const { rerender } = render(
      <ErrorState title="Settings could not load." error={new Error('offline')} />,
    );
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();

    rerender(
      <ErrorState
        title="Settings could not load."
        error={new Error('offline')}
        onRetry={onRetry}
      />,
    );
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
