import { useEffect, useState } from 'react';

/**
 * One autosave for everything the workspace lets the user type (ROADMAP P4-14).
 *
 * The draft and the notes each had their own copy of the same three effects
 * (P4-11, P7-4), and each copy had its own way of losing work: the draft keyed
 * what was unsaved on the *route*, so leaving for a problem that had not loaded
 * yet filed the old problem's code under the new one's name; and neither ever
 * retried a failed write - the PUT failed, the pending text was already gone,
 * and nothing on screen said so. One implementation is how both are fixed once.
 *
 * The rules, each of which is a bug that happened:
 *
 *   - **The scope is what the editor holds, not what the URL says.** The caller
 *     passes the scope its text was *loaded from*, and null while it is showing
 *     something that belongs nowhere yet (a problem still loading). Text is only
 *     ever written under the scope it came from.
 *   - **Debounced, and flushed rather than dropped.** Leaving a scope - another
 *     language, another problem, unmounting - writes what was pending there
 *     immediately. The cleanup that flushes is keyed on the scope alone, so a
 *     keystroke never triggers it.
 *   - **A failed write is kept and retried**, with backoff, until it lands or is
 *     superseded by a newer write for the same scope; `retrying` is true for as
 *     long as anything is owed, so the screen can say "Not saved".
 *   - **The tab closing is a flush too.** `pagehide` sends whatever is owed
 *     through `writeOnUnload`, which the caller implements with `keepalive` - a
 *     normal request from a page being torn down is cancelled with it.
 */

/** How long after the last keystroke text is written. */
const AUTOSAVE_MS = 800;

/** The first retry of a failed write, doubling each time up to the ceiling. */
const RETRY_FIRST_MS = 2_000;
const RETRY_MAX_MS = 30_000;

export interface AutosaveScope {
  /** Identifies the thing being edited; two scopes with one key are one scope. */
  readonly key: string;
}

export interface DebouncedAutosaveOptions<S extends AutosaveScope> {
  /**
   * Where `value` belongs, or null while it belongs nowhere. Memoise it: its
   * identity is an effect dependency.
   */
  scope: S | null;
  /** What the editor actually holds now. */
  value: string;
  /** What the server already has for this scope; equal to `value` means nothing is owed. */
  saved: string;
  /** Writes one value. A rejection is a failed write, and is retried. */
  write: (scope: S, value: string) => Promise<unknown>;
  /** The same write for a page that is going away: `keepalive`, errors swallowed. */
  writeOnUnload: (scope: S, value: string) => void;
  /**
   * A write landed. `current` says whether its scope is still the one on
   * screen, which is when the caller may mark that value as saved - a flush on
   * the way out answers after the next scope is showing, and marking *that*
   * scope's text saved would hide its first edit.
   */
  onSaved?: (scope: S, value: string, current: boolean) => void;
  delayMs?: number;
}

export interface DebouncedAutosave {
  /** Writes what is pending now instead of after the debounce. */
  flush: () => void;
  /**
   * Writes this value for the current scope now (Ctrl+S). Resolves true once
   * it has landed and the scope is still on screen; false when there was no
   * scope, the scope changed meanwhile, or the write failed (it is then
   * retried like any other, and `retrying` says so).
   */
  saveNow: (value: string) => Promise<boolean>;
  /** Forgets anything owed for the current scope (reset-to-starter deletes it). */
  discard: () => void;
  /** Something failed to save and is being retried. */
  retrying: boolean;
  /** Why the most recent failed write failed. */
  error: Error | null;
}

interface Owed<S> {
  scope: S;
  value: string;
}

interface Failure<S> extends Owed<S> {
  /** How many times it has failed, for the backoff. */
  attempts: number;
}

interface SaverHooks<S extends AutosaveScope> {
  scope: S | null;
  saved: string;
  write: (scope: S, value: string) => Promise<unknown>;
  writeOnUnload: (scope: S, value: string) => void;
  onSaved: ((scope: S, value: string, current: boolean) => void) | undefined;
}

/**
 * The part with no React in it: what is owed, what failed, and the timers.
 *
 * A class held in state rather than a handful of refs, because the retry path
 * and the flush path call each other and every one of them reads the latest
 * callbacks - which is what `hooks` is, refreshed after every render.
 */
class Saver<S extends AutosaveScope> {
  /** Unsaved text for the scope on screen, or null when nothing is owed. */
  private pending: Owed<S> | null = null;
  private hooks: SaverHooks<S> | null = null;
  /** Set by the hook, so a failure can re-render the note. */
  private onTrouble: (error: Error | null) => void = () => undefined;

  configure(hooks: SaverHooks<S>, onTrouble: (error: Error | null) => void): void {
    this.hooks = hooks;
    this.onTrouble = onTrouble;
  }

  /** Records what is owed: the text on screen, when it differs from the server's. */
  track(scope: S | null, value: string, saved: string): void {
    this.pending = scope !== null && value !== saved ? { scope, value } : null;
  }

  private readonly failures = new Map<string, Failure<S>>();
  /** Per scope, so only the newest write's answer moves anything. */
  private readonly sequence = new Map<string, number>();
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private live = true;

  flush(): void {
    const next = this.pending;
    if (next === null) return;
    this.pending = null;
    void this.send(next.scope, next.value, 0);
  }

  saveNow(value: string): Promise<boolean> {
    const hooks = this.hooks;
    const scope = hooks?.scope ?? null;
    if (hooks === null || scope === null) return Promise.resolve(false);
    this.pending = null;
    if (value === hooks.saved) {
      // The server already has exactly this; anything that failed before it
      // is older, and writing it now would replace the newer text.
      this.failures.delete(scope.key);
      this.settle();
      return Promise.resolve(true);
    }
    return this.send(scope, value, 0);
  }

  discard(): void {
    const key = this.hooks?.scope?.key;
    this.pending = null;
    if (key === undefined) return;
    this.failures.delete(key);
    // A write already in flight must not report itself saved afterwards.
    this.sequence.set(key, (this.sequence.get(key) ?? 0) + 1);
    this.settle();
  }

  /** The page is going away: everything owed goes out with `keepalive`. */
  unload(): void {
    const hooks = this.hooks;
    if (hooks === null) return;
    const owed = [...this.failures.values()].filter(
      (failure) => failure.scope.key !== this.pending?.scope.key,
    );
    if (this.pending !== null) owed.push({ ...this.pending, attempts: 0 });
    this.pending = null;
    this.failures.clear();
    for (const { scope, value } of owed) hooks.writeOnUnload(scope, value);
  }

  /**
   * Unmounted. Pending text has already been flushed by the scope's cleanup;
   * failed writes get one last ordinary attempt, since no timer will be left
   * to retry them and the page itself is still open.
   */
  dispose(): void {
    this.live = false;
    this.clearRetry();
    const owed = [...this.failures.values()];
    this.failures.clear();
    for (const { scope, value } of owed) void this.send(scope, value, 0);
  }

  revive(): void {
    this.live = true;
  }

  private send(scope: S, value: string, attempts: number): Promise<boolean> {
    const hooks = this.hooks;
    if (hooks === null) return Promise.resolve(false);
    const key = scope.key;
    const turn = (this.sequence.get(key) ?? 0) + 1;
    this.sequence.set(key, turn);
    // This write supersedes anything that failed for the same scope: it is the
    // same text or newer.
    this.failures.delete(key);

    return hooks.write(scope, value).then(
      () => {
        if (this.sequence.get(key) !== turn) return false;
        const current = this.hooks?.scope?.key === key;
        this.hooks?.onSaved?.(scope, value, current);
        this.settle();
        return current;
      },
      (error: unknown) => {
        if (this.sequence.get(key) === turn) {
          this.failures.set(key, { scope, value, attempts: attempts + 1 });
          if (this.live) {
            this.onTrouble(error instanceof Error ? error : new Error(String(error)));
            this.scheduleRetry();
          }
        }
        return false;
      },
    );
  }

  private settle(): void {
    if (this.failures.size > 0) return;
    this.clearRetry();
    if (this.live) this.onTrouble(null);
  }

  private scheduleRetry(): void {
    if (this.retryTimer !== null || this.failures.size === 0) return;
    const attempts = Math.min(...[...this.failures.values()].map((failure) => failure.attempts));
    const delay = Math.min(RETRY_FIRST_MS * 2 ** (attempts - 1), RETRY_MAX_MS);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.retry();
    }, delay);
  }

  private retry(): void {
    for (const failure of [...this.failures.values()]) {
      const newer = this.pending;
      if (newer !== null && newer.scope.key === failure.scope.key) {
        // Typing has moved on since the failure, and the newer text is the
        // one worth writing - the older one would only be overwritten.
        this.pending = null;
        void this.send(newer.scope, newer.value, failure.attempts);
      } else {
        void this.send(failure.scope, failure.value, failure.attempts);
      }
    }
  }

  private clearRetry(): void {
    if (this.retryTimer === null) return;
    clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }
}

export function useDebouncedAutosave<S extends AutosaveScope>({
  scope,
  value,
  saved,
  write,
  writeOnUnload,
  onSaved,
  delayMs = AUTOSAVE_MS,
}: DebouncedAutosaveOptions<S>): DebouncedAutosave {
  const [saver] = useState(() => new Saver<S>());
  const [error, setError] = useState<Error | null>(null);
  const key = scope?.key ?? null;

  useEffect(() => {
    saver.configure({ scope, saved, write, writeOnUnload, onSaved }, setError);
  }, [saver, scope, saved, write, writeOnUnload, onSaved]);

  // 1. What is owed. Only for a scope that exists: text on screen while the
  //    next problem loads belongs to the previous one, whose cleanup below has
  //    already written it.
  useEffect(() => {
    saver.track(scope, value, saved);
  }, [saver, scope, value, saved]);

  // 2. The debounce. Its cleanup only clears the timer - one that flushed
  //    would write on every keystroke, which is the opposite of a debounce.
  useEffect(() => {
    if (key === null || value === saved) return;
    const timer = setTimeout(() => {
      saver.flush();
    }, delayMs);
    return () => {
      clearTimeout(timer);
    };
  }, [saver, key, value, saved, delayMs]);

  // 3. Leaving the scope. The only cleanup that means "we are going", and it
  //    runs on exactly the things most likely to follow typing: another
  //    language, another problem, Back.
  useEffect(
    () => () => {
      saver.flush();
    },
    [saver, key],
  );

  // Unmounting, after (3) has flushed: failures get their last attempt.
  useEffect(() => {
    saver.revive();
    return () => {
      saver.dispose();
    };
  }, [saver]);

  // The tab closing, which no React cleanup sees. `pagehide` fires on close,
  // reload and navigating away, including into the back-forward cache where
  // `beforeunload` does not.
  useEffect(() => {
    const onPageHide = (): void => {
      saver.unload();
    };
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [saver]);

  const [api] = useState<Omit<DebouncedAutosave, 'retrying' | 'error'>>(() => ({
    flush: () => {
      saver.flush();
    },
    saveNow: (next) => saver.saveNow(next),
    discard: () => {
      saver.discard();
    },
  }));

  return { ...api, retrying: error !== null, error };
}
