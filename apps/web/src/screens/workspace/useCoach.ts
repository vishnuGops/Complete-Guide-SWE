import { useCallback, useEffect, useRef, useState } from 'react';
import type { CoachFeedback, CoachSkipReason, Language } from '@devpromax/shared';
import { ApiError } from '../../api/client.js';
import { streamCoach } from '../../api/coachStream.js';

/**
 * One coaching conversation, as the panel sees it (ROADMAP P5-3).
 *
 * The state here is deliberately not TanStack Query's. A query caches a value
 * that arrives once; this is a value that arrives in pieces, where the pieces
 * are the point - the panel paints prose as it is written. Modelling that as a
 * mutation would mean the whole answer appearing at the end, which is the exact
 * behaviour the streaming half of P5-1 exists to avoid.
 */

export interface CoachTurn {
  role: 'user' | 'coach';
  content: string;
  /** Present on the rubric turn, absent on plain chat replies. */
  feedback?: CoachFeedback;
}

export type CoachPhase = 'idle' | 'streaming' | 'error' | 'skipped';

export interface CoachState {
  phase: CoachPhase;
  /** The conversation so far; the last entry is the one being written. */
  turns: CoachTurn[];
  /** Text arriving right now, before it becomes a turn. */
  streaming: string;
  error: { message: string; retryable: boolean } | null;
  skipped: { reason: CoachSkipReason; message: string } | null;
  sessionId: string | null;
}

const EMPTY: CoachState = {
  phase: 'idle',
  turns: [],
  streaming: '',
  error: null,
  skipped: null,
  sessionId: null,
};

export interface AskOptions {
  slug: string;
  language: Language;
  code: string;
  revealedHints?: number;
  masteryCheck?: boolean;
  requestFullSolution?: boolean;
  /**
   * Start a fresh conversation instead of continuing the last one (P5-9).
   *
   * What the user does after the spend cap trips, and the only way to reset the
   * prompt window (D20) without changing problem.
   */
  newConversation?: boolean;
}

export function useCoach(slug: string, language: Language) {
  const [state, setState] = useState<CoachState>(EMPTY);
  const abortRef = useRef<AbortController | null>(null);

  /**
   * A conversation belongs to one problem in one language.
   *
   * Without this, switching from Python to Java leaves the previous language's
   * feedback on screen, attached to code that is no longer in the editor -
   * advice about lines the user cannot see.
   */
  const scope = `${slug}:${language}`;
  const [scoped, setScoped] = useState(scope);
  if (scoped !== scope) {
    setScoped(scope);
    setState(EMPTY);
  }

  /**
   * Cancels the turn in flight when the scope changes, and on unmount.
   *
   * Not beside the state reset above, even though that is where it belongs
   * logically: aborting is a side effect, and a ref must not be touched during
   * render. A cleanup keyed on `scope` fires on both occasions that matter -
   * switching language and leaving the page - and either way the point is the
   * same, that a request nobody will read must stop being billed.
   */
  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [scope],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState((prev) =>
      prev.phase === 'streaming'
        ? {
            ...prev,
            phase: 'idle',
            streaming: '',
            // Whatever had arrived is kept as a turn: it is real advice, and
            // throwing it away would punish the user for stopping a long one.
            turns:
              prev.streaming === ''
                ? prev.turns
                : [...prev.turns, { role: 'coach', content: prev.streaming }],
          }
        : prev,
    );
  }, []);

  /** Drives one request to completion, folding each event into state. */
  const consume = useCallback(
    async (path: '/api/coach/feedback' | '/api/coach/chat', body: unknown, signal: AbortSignal) => {
      let streamed = '';

      try {
        for await (const event of streamCoach(path, body, { signal })) {
          switch (event.type) {
            case 'start':
              setState((prev) => ({ ...prev, sessionId: event.sessionId }));
              break;

            case 'markdown':
              streamed += event.delta;
              setState((prev) => ({ ...prev, streaming: streamed }));
              break;

            case 'done':
              setState((prev) => ({
                ...prev,
                phase: 'idle',
                streaming: '',
                turns: [
                  ...prev.turns,
                  {
                    role: 'coach',
                    content: event.feedback.feedbackMarkdown,
                    feedback: event.feedback,
                  },
                ],
              }));
              break;

            case 'reply':
              setState((prev) => ({
                ...prev,
                phase: 'idle',
                streaming: '',
                turns: [...prev.turns, { role: 'coach', content: event.content }],
              }));
              break;

            case 'error':
              setState((prev) => ({
                ...prev,
                phase: 'error',
                streaming: '',
                error: { message: event.message, retryable: event.retryable },
                // Partial text is kept for the same reason Stop keeps it.
                turns:
                  streamed === ''
                    ? prev.turns
                    : [...prev.turns, { role: 'coach', content: streamed }],
              }));
              break;

            case 'skipped':
              setState((prev) => ({
                ...prev,
                phase: 'skipped',
                streaming: '',
                skipped: { reason: event.reason, message: event.message },
              }));
              break;
          }
        }
      } catch (error) {
        if (signal.aborted) return;
        setState((prev) => ({
          ...prev,
          phase: 'error',
          streaming: '',
          error: {
            message: error instanceof ApiError ? error.message : 'The coach could not be reached.',
            retryable: true,
          },
        }));
      } finally {
        // Only clear the shared handle if this turn still owns it; a newer turn
        // may already have replaced it.
        setState((prev) => (prev.phase === 'streaming' ? { ...prev, phase: 'idle' } : prev));
      }
    },
    [],
  );

  const begin = useCallback((): AbortSignal => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    return controller.signal;
  }, []);

  /** The AI Help button, and `Ctrl+Shift+H`. */
  const ask = useCallback(
    (options: AskOptions) => {
      const signal = begin();
      setState((prev) => ({
        ...prev,
        phase: 'streaming',
        streaming: '',
        error: null,
        skipped: null,
        // A new conversation is a new transcript: keeping the old turns on
        // screen would imply the coach still remembers them, and after this
        // request it does not.
        ...(options.newConversation === true ? { turns: [], sessionId: null } : {}),
      }));
      void consume(
        '/api/coach/feedback',
        {
          slug: options.slug,
          language: options.language,
          code: options.code,
          revealedHints: options.revealedHints ?? 0,
          masteryCheck: options.masteryCheck ?? false,
          requestFullSolution: options.requestFullSolution ?? false,
          newConversation: options.newConversation ?? false,
        },
        signal,
      );
    },
    [begin, consume],
  );

  /** A follow-up question, which needs a conversation to follow. */
  const followUp = useCallback(
    (message: string) => {
      const sessionId = state.sessionId;
      if (sessionId === null) return;

      const signal = begin();
      setState((prev) => ({
        ...prev,
        phase: 'streaming',
        streaming: '',
        error: null,
        skipped: null,
        turns: [...prev.turns, { role: 'user', content: message }],
      }));
      void consume('/api/coach/chat', { sessionId, message }, signal);
    },
    [begin, consume, state.sessionId],
  );

  return { state, ask, followUp, stop };
}
