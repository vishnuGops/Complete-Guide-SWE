import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { CoachFeedback, CoachSkipReason, Language } from '@devpromax/shared';
import { ApiError } from '../../api/client.js';
import { streamCoach } from '../../api/coachStream.js';
import { keys } from '../../api/hooks.js';

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
  /**
   * The problem and language this conversation belongs to (ROADMAP P4-15).
   *
   * In the state itself, so every update a turn makes can check it is still
   * writing into its own conversation. Aborting on a scope change is not
   * enough on its own: an event already read from the stream is delivered
   * whether or not the request has since been cancelled, and it used to land
   * in the next language's empty panel.
   */
  scope: string;
  phase: CoachPhase;
  /** The conversation so far; the last entry is the one being written. */
  turns: CoachTurn[];
  /** Text arriving right now, before it becomes a turn. */
  streaming: string;
  error: { message: string; retryable: boolean } | null;
  skipped: { reason: CoachSkipReason; message: string } | null;
  sessionId: string | null;
}

const EMPTY: Omit<CoachState, 'scope'> = {
  phase: 'idle',
  turns: [],
  streaming: '',
  error: null,
  skipped: null,
  sessionId: null,
};

/** Said when a stream ends without saying how it ended (P4-15). */
export const CUT_OFF_MESSAGE =
  'The answer stopped before it was finished. What arrived is kept above; ask again for the rest.';

export interface AskOptions {
  slug: string;
  language: Language;
  code: string;
  revealedHints?: number;
  interviewMode?: boolean;
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
  /**
   * A conversation belongs to one problem in one language.
   *
   * Without this, switching from Python to Java leaves the previous language's
   * feedback on screen, attached to code that is no longer in the editor -
   * advice about lines the user cannot see.
   */
  const scope = `${slug}:${language}`;
  const [state, setState] = useState<CoachState>(() => ({ ...EMPTY, scope }));
  if (state.scope !== scope) {
    setState({ ...EMPTY, scope });
  }

  const abortRef = useRef<AbortController | null>(null);
  const queryClient = useQueryClient();

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

  /**
   * Drives one request to completion, folding each event into state.
   *
   * `controller` rather than a bare signal, so this turn can tell whether it is
   * still the current one (ROADMAP P4-12). The bug: the `finally` below reset
   * `phase` unconditionally, so starting a second turn while the first was
   * streaming - `Ctrl+Shift+H` and Try again are both live during a stream -
   * had the *old* turn's abort rejection mark the app idle while the new turn's
   * text kept arriving. Stop then did nothing, because as far as the panel was
   * concerned nothing was running.
   *
   * Every update goes through `update`, which drops it once the turn has been
   * cancelled or the conversation it belongs to is no longer the one in state
   * (P4-15): a turn outlives its scope by however long its stream takes to
   * notice the abort.
   */
  const consume = useCallback(
    async (
      path: '/api/coach/feedback' | '/api/coach/chat',
      body: unknown,
      controller: AbortController,
      turnSlug: string,
      turnScope: string,
    ) => {
      const { signal } = controller;
      let streamed = '';
      /** Whether the stream said how it ended, one way or another. */
      let ended = false;
      const update = (next: (prev: CoachState) => CoachState): void => {
        if (signal.aborted) return;
        setState((prev) => (prev.scope === turnScope ? next(prev) : prev));
      };
      const keepPartial = (turns: CoachTurn[]): CoachTurn[] =>
        streamed === '' ? turns : [...turns, { role: 'coach', content: streamed }];

      try {
        for await (const event of streamCoach(path, body, { signal })) {
          if (signal.aborted) return;
          switch (event.type) {
            case 'start':
              update((prev) => ({ ...prev, sessionId: event.sessionId }));
              break;

            case 'markdown':
              streamed += event.delta;
              update((prev) => ({ ...prev, streaming: streamed }));
              break;

            case 'done':
              ended = true;
              update((prev) => ({
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
              /*
               * A rubric turn can move the status - coach mastery is one of the
               * four things that may (D11) - and every turn is activity the
               * dashboard counts (P4-15). The same queries a submit refreshes,
               * for the same reason: the header, the list and the progress page
               * must not go on saying Solved about a problem the coach has just
               * called Mastered.
               */
              void queryClient.invalidateQueries({ queryKey: keys.problems });
              void queryClient.invalidateQueries({ queryKey: keys.problem(turnSlug) });
              void queryClient.invalidateQueries({ queryKey: keys.progress });
              void queryClient.invalidateQueries({ queryKey: keys.dashboard });
              break;

            case 'reply':
              ended = true;
              update((prev) => ({
                ...prev,
                phase: 'idle',
                streaming: '',
                turns: [...prev.turns, { role: 'coach', content: event.content }],
              }));
              break;

            case 'error':
              ended = true;
              update((prev) => ({
                ...prev,
                phase: 'error',
                streaming: '',
                error: { message: event.message, retryable: event.retryable },
                // Partial text is kept for the same reason Stop keeps it.
                turns: keepPartial(prev.turns),
              }));
              break;

            case 'skipped':
              ended = true;
              update((prev) => ({
                ...prev,
                phase: 'skipped',
                streaming: '',
                skipped: { reason: event.reason, message: event.message },
              }));
              break;
          }
        }
      } catch (error) {
        ended = true;
        update((prev) => ({
          ...prev,
          phase: 'error',
          streaming: '',
          error: {
            message: error instanceof ApiError ? error.message : 'The coach could not be reached.',
            retryable: true,
          },
          turns: keepPartial(prev.turns),
        }));
      } finally {
        // Only this turn's own ending may end the streaming state. A newer turn
        // has already replaced the handle, and its stream is still arriving.
        if (abortRef.current === controller) {
          abortRef.current = null;
          /*
           * A stream that simply closed, with no final event (P4-15): the
           * server went away mid-answer, or something between cut it. This used
           * to leave the half-written text in the streaming slot for good,
           * marked `aria-busy` - a screen reader was told to wait for a turn
           * that was never going to finish. It is kept as a turn, like a
           * stopped one, and said to be cut off, with the retry that fixes it.
           */
          if (!ended) {
            update((prev) =>
              prev.phase === 'streaming'
                ? {
                    ...prev,
                    phase: 'error',
                    streaming: '',
                    error: { message: CUT_OFF_MESSAGE, retryable: true },
                    turns: keepPartial(prev.turns),
                  }
                : prev,
            );
          }
        }
      }
    },
    [queryClient],
  );

  const begin = useCallback((): AbortController => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    return controller;
  }, []);

  /** The AI Help button, and `Ctrl+Shift+H`. */
  const ask = useCallback(
    (options: AskOptions) => {
      const controller = begin();
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
          interviewMode: options.interviewMode ?? false,
          masteryCheck: options.masteryCheck ?? false,
          requestFullSolution: options.requestFullSolution ?? false,
          newConversation: options.newConversation ?? false,
        },
        controller,
        options.slug,
        `${options.slug}:${options.language}`,
      );
    },
    [begin, consume],
  );

  /** A follow-up question, which needs a conversation to follow. */
  const followUp = useCallback(
    (message: string) => {
      const sessionId = state.sessionId;
      if (sessionId === null) return;

      const controller = begin();
      setState((prev) => ({
        ...prev,
        phase: 'streaming',
        streaming: '',
        error: null,
        skipped: null,
        turns: [...prev.turns, { role: 'user', content: message }],
      }));
      void consume('/api/coach/chat', { sessionId, message }, controller, slug, scope);
    },
    [begin, consume, state.sessionId, slug, scope],
  );

  return { state, ask, followUp, stop };
}
