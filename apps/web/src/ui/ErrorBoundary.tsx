import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from './Button.js';
import { ErrorState } from './ErrorState.js';

/**
 * The last thing between a thrown error and a blank page (ROADMAP P4-12).
 *
 * The concrete failure this exists for: the editor is a lazy chunk, and after
 * the dev server restarts, the hashed `CodeEditor-*.js` the page is holding a
 * reference to no longer exists. The import rejects, the Suspense boundary has
 * nothing to show for a rejection, and React unmounts the whole tree - so
 * `/problems/<slug>` becomes a white screen with the answer only in the
 * console. A reload fixes it, which is exactly the kind of thing a user cannot
 * be expected to guess.
 *
 * A class, because this is the one thing in React that hooks cannot do:
 * `componentDidCatch` has no hook equivalent.
 *
 * Reset is deliberately *not* offered as "try rendering that again" - the state
 * that produced the error is usually still there, and a retry that fails
 * identically reads as a broken button. `onReset` is for the caller that has
 * something real to reset to; otherwise the action is a reload, which is what
 * actually fixes a stale chunk.
 */

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** Names what broke, as a sentence: "The editor could not load." */
  title: string;
  /** Offered instead of a reload when the caller can recover in place. */
  onReset?: () => void;
  className?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    // The console is where a developer will look, and this is a local app whose
    // user often is one. Nothing is sent anywhere.
    console.error('Unhandled error in', this.props.title, error, info.componentStack);
  }

  private readonly reset = (): void => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  override render(): ReactNode {
    const { error } = this.state;
    if (error === null) return this.props.children;

    return (
      <div className={this.props.className}>
        <ErrorState
          title={this.props.title}
          error={error}
          {...(this.props.onReset ? { onRetry: this.reset } : {})}
        />
        {!this.props.onReset && (
          <div className="px-6">
            <Button
              variant="secondary"
              onClick={() => {
                window.location.reload();
              }}
            >
              Reload the page
            </Button>
          </div>
        )}
      </div>
    );
  }
}
