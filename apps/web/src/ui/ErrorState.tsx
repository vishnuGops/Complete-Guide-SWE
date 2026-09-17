import { Button } from './Button.js';
import { cn } from './cn.js';

/**
 * A query that did not answer (ROADMAP P4-10).
 *
 * Three things, in the order someone needs them: what failed, what the server
 * said, and a way to try again. The retry matters more here than it would in a
 * hosted app - the usual reason a request fails in DevProMax is that the local
 * server is still starting, or was restarted by a file watcher mid-session, and
 * both of those fix themselves in the time it takes to read the message.
 *
 * `role="alert"` rather than a live region on a timer: a screen that has nothing
 * on it but an error is not a background update, and the user is waiting for
 * exactly this sentence.
 *
 * `onRetry` is optional because not every caller has something to retry, but a
 * caller that does should pass it - "Try again" is the entire recovery path for
 * a screen with no content on it.
 */
export interface ErrorStateProps {
  /** What was being loaded, as a sentence: "The problem list could not load." */
  title: string;
  error: Error;
  onRetry?: (() => void) | undefined;
  className?: string;
}

export function ErrorState({ title, error, onRetry, className }: ErrorStateProps) {
  return (
    <div className={cn('max-w-prose p-6', className)} role="alert">
      <p className="text-danger-fg text-sm font-medium">{title}</p>
      <p className="text-fg-muted mt-1 text-sm">{error.message}</p>
      {onRetry && (
        <Button className="mt-3" variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
