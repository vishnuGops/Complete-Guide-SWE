import { memo, useState } from 'react';
import {
  MAX_RUBRIC_SCORE,
  RUBRIC_DIMENSIONS,
  RUBRIC_LABEL,
  type CoachFeedback,
  type HintLevel,
} from '@devpromax/shared';
import { Markdown } from '../../markdown/Markdown.js';
import { SHORTCUTS } from '../../shortcuts/shortcuts.js';
import { Button, Callout, CoachMark, Input, Keys, cn } from '../../ui/index.js';
import type { CoachState } from './useCoach.js';

/**
 * The Coach panel (ROADMAP P5-3, D13).
 *
 * The tab P4-6 deliberately left out, now that there is something behind it.
 *
 * What the panel has to get right is the order things appear in. The prose
 * streams first and the rubric card lands at the end, because the rubric needs
 * the whole document and the prose does not - so the useful half is readable
 * while the scores are still being decided. Rendering nothing until the scores
 * arrive would waste the entire streaming apparatus underneath it.
 */

/** Where each rung sits, for the line that says how much help was given. */
const HINT_DESCRIPTION: Record<HintLevel, string> = {
  nudge: 'A nudge — pointing at something you already wrote.',
  concept: 'A concept — the idea, not applied to your code.',
  approach: 'An approach — the shape of the solution, in prose.',
  pseudocode: 'Pseudocode — the steps, not the code.',
  solution: 'The full solution.',
};

/**
 * One rubric dimension as a row of filled and empty pips. Filled pips are
 * `fg-muted` and a full score is `success`: the rubric is a reading, not an
 * action, so it has no business in the accent (P9-6).
 *
 * Pips rather than a bar or a number: five dimensions out of four points each
 * is a small enough range to read at a glance, and a shape the eye can compare
 * down a column beats five progress bars. The accessible name carries the
 * numbers, because the pips are decoration to a screen reader.
 */
function ScoreRow({ label, score }: { label: string; score: number }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="text-fg-muted w-32 shrink-0 text-xs">{label}</span>
      {/*
        `role="img"` with the label, because `aria-label` on a bare `span` is
        ignored: the attribute only names an element that has a role to name
        (ROADMAP P4-13). Without it the five bars were five nothings, and the
        score they carry was unreadable to a screen reader.
      */}
      <span className="flex gap-0.5" role="img" aria-label={`${score} out of ${MAX_RUBRIC_SCORE}`}>
        {Array.from({ length: MAX_RUBRIC_SCORE }, (_, i) => (
          <span
            key={i}
            aria-hidden
            className={cn(
              'h-1.5 w-5 rounded-xs',
              i < score ? (score === MAX_RUBRIC_SCORE ? 'bg-success' : 'bg-fg-muted') : 'bg-border',
            )}
          />
        ))}
      </span>
      <span className="text-fg-subtle tnum ml-1 text-2xs" aria-hidden>
        {score}/{MAX_RUBRIC_SCORE}
      </span>
    </div>
  );
}

function RubricCard({ feedback }: { feedback: CoachFeedback }) {
  return (
    <div className="bg-surface-sunken mt-3 rounded-lg p-3">
      <p className="text-fg-muted mb-2 text-xs font-medium">Rubric</p>

      {RUBRIC_DIMENSIONS.map((dimension) => (
        <ScoreRow
          key={dimension}
          label={RUBRIC_LABEL[dimension]}
          score={feedback.scores[dimension]}
        />
      ))}

      {feedback.nextHintLevel && (
        <p className="text-fg-subtle border-border mt-2 border-t pt-2 text-xs">
          {HINT_DESCRIPTION[feedback.nextHintLevel]}
        </p>
      )}
    </div>
  );
}

/**
 * The one thing to do next.
 *
 * Set apart from the prose because it is the sentence the user acts on, and in
 * a panel of five paragraphs the actionable one should not have to be hunted
 * for. A Callout - the tinted inset DESIGN.md 10 keeps for the suggested next
 * step - and in the coach's serif, because the words are the coach's.
 */
function NextStep({ text }: { text: string }) {
  return (
    <Callout className="mt-3">
      <p className="text-fg-muted text-xs font-medium">Next step</p>
      <p className="text-fg mt-1 font-serif text-md">{text}</p>
    </Callout>
  );
}

/** Who is speaking, above each of the coach's turns. */
function CoachLabel() {
  return (
    <p className="text-fg-muted mb-1.5 flex items-center gap-2 text-xs font-medium">
      <CoachMark />
      Coach
    </p>
  );
}

function Turn({ turn }: { turn: CoachState['turns'][number] }) {
  if (turn.role === 'user') {
    return (
      <div className="border-border-strong mt-4 border-l-2 pl-3">
        <p className="text-fg-muted text-xs font-medium">You asked</p>
        <p className="text-fg mt-1 text-sm">{turn.content}</p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <CoachLabel />
      {/*
        The coach's words are in serif and nothing else is (DESIGN.md 5): that
        is how advice is told from interface at a glance. Code inside the
        answer stays mono.
      */}
      {turn.feedback && <p className="text-fg mb-2 font-serif text-lg">{turn.feedback.summary}</p>}
      <Markdown content={turn.content} trust="coach" className="md-coach" />
      {turn.feedback?.nextStep !== undefined && <NextStep text={turn.feedback.nextStep} />}
      {turn.feedback && <RubricCard feedback={turn.feedback} />}
    </div>
  );
}

export interface CoachPanelProps {
  state: CoachState;
  /**
   * What the judge alone can say about the last run (P5-6). Shown in the
   * no-key state, so the Coach tab still answers "help me" for someone who has
   * not configured a provider - and shows what a local answer looks like next
   * to what a coached one would.
   */
  fallback?: { headline: string; points: string[] } | null;
  /** Runs a fresh review of whatever is in the editor now. */
  onAsk: () => void;
  /**
   * Abandons this conversation and reviews again in a new one (P5-9).
   *
   * Two things need it: the spend cap, whose message has always said to start a
   * fresh one, and the prompt window (D20) - a long conversation carries its
   * whole feedback context into every follow-up, and at some point starting
   * over is both cheaper and better advice.
   */
  onNewConversation: () => void;
  onFollowUp: (message: string) => void;
  onStop: () => void;
  /** Opens Settings; the no-key state is the only thing that needs it. */
  onOpenSettings: () => void;
}

function CoachPanelPanel({
  state,
  fallback,
  onAsk,
  onNewConversation,
  onFollowUp,
  onStop,
  onOpenSettings,
}: CoachPanelProps) {
  const [question, setQuestion] = useState('');
  const streaming = state.phase === 'streaming';
  const empty = state.turns.length === 0 && state.streaming === '';

  return (
    <div className="flex min-h-0 flex-col px-5 py-4">
      {/*
        The no-key state is not an error and is not styled as one: nothing has
        gone wrong, the feature simply has not been set up. It gets the one
        button that fixes it rather than a red message that does not.
      */}
      {state.phase === 'skipped' && state.skipped?.reason === 'no_api_key' ? (
        <div className="bg-surface-sunken rounded-lg p-4">
          <p className="text-fg text-sm">{state.skipped.message}</p>
          <Button className="mt-3" onClick={onOpenSettings}>
            Open Settings
          </Button>

          {fallback && fallback.points.length > 0 && (
            <div className="border-border mt-3 border-t pt-3">
              <p className="text-fg-muted text-xs font-medium">What the judge can tell you</p>
              <p className="text-fg-muted mt-1 text-sm">{fallback.headline}</p>
              <ul className="text-fg-muted mt-2 flex list-disc flex-col gap-1 pl-4 text-sm">
                {fallback.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : state.phase === 'skipped' && state.skipped ? (
        <div>
          <p className="text-fg-muted text-sm">{state.skipped.message}</p>
          {state.skipped.reason === 'spend_cap_reached' && (
            <Button className="mt-3" size="sm" variant="secondary" onClick={onNewConversation}>
              Start a new conversation
            </Button>
          )}
        </div>
      ) : null}

      {empty && state.phase === 'idle' && (
        <div>
          <p className="text-fg-muted text-sm">
            Ask for feedback on the code in the editor. The coach reads what you have written and
            the last thing the judge said about it, and answers with a rubric and one next step.
          </p>
          <p className="text-fg-subtle mt-2 text-xs">
            It will not hand over the solution unless the problem is already solved and you ask for
            it.
          </p>
          {/*
            Outlined, not filled: Submit is the one filled pill on this screen,
            and asking costs money (D13).
          */}
          <Button className="mt-3" variant="primary-outline" onClick={onAsk}>
            <CoachMark />
            Ask for help
          </Button>
        </div>
      )}

      {state.turns.map((turn, index) => (
        <Turn key={index} turn={turn} />
      ))}

      {/*
        The half-written answer, rendered as markdown like any other turn.

        `role="status"` so the arrival is announced rather than only seen, and
        `aria-busy` so it is announced as still in progress - a screen reader
        that read a partial paragraph as finished would be worse than silence.
      */}
      {state.streaming !== '' && (
        <div className="mt-4" role="status" aria-busy="true" data-testid="coach-streaming">
          <CoachLabel />
          <Markdown content={state.streaming} trust="coach" className="md-coach" />
        </div>
      )}

      {streaming && state.streaming === '' && (
        <p className="text-fg-muted mt-4 text-sm" role="status">
          Reading your code…
        </p>
      )}

      {state.phase === 'error' && state.error && (
        <div className="mt-4" role="alert">
          <p className="text-danger-fg text-sm">{state.error.message}</p>
          {state.error.retryable && (
            <Button className="mt-2" size="sm" onClick={onAsk}>
              Try again
            </Button>
          )}
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        {streaming ? (
          <Button size="sm" variant="secondary" onClick={onStop}>
            Stop
          </Button>
        ) : (
          !empty && (
            <>
              <Button size="sm" variant="secondary" onClick={onAsk}>
                Review again
              </Button>
              <Button size="sm" variant="ghost" onClick={onNewConversation}>
                New conversation
              </Button>
            </>
          )
        )}
        {!streaming && empty && state.phase !== 'idle' && (
          <Button size="sm" variant="secondary" onClick={onAsk}>
            Ask for help
          </Button>
        )}
      </div>

      {/*
        Follow-up needs a conversation to follow, so it appears only once there
        is one. A chat box above an empty panel would invite a question the
        server has nowhere to put.
      */}
      {state.sessionId !== null && (
        <form
          className="border-border mt-4 flex items-end gap-2 border-t pt-3"
          onSubmit={(event) => {
            event.preventDefault();
            const trimmed = question.trim();
            if (trimmed === '' || streaming) return;
            onFollowUp(trimmed);
            setQuestion('');
          }}
        >
          {/*
            Named with `aria-label`: the row is a text box and a button, and a
            visible label above it would push the conversation up by a line
            every time. The placeholder is an example, not the name - a
            placeholder disappears as soon as it is typed into.
          */}
          <Input
            aria-label="Ask the coach a follow-up question"
            value={question}
            onChange={(event) => {
              setQuestion(event.target.value);
            }}
            /*
              The field claims `Ctrl+Enter` for sending (P4-12).

              The registry listens in the capture phase on the window, so
              without this the keys the user has just been told mean "run"
              would run the judge from inside a text box - and the question they
              typed would sit there unsent. `stopPropagation` in capture on the
              input itself is what gets in front of the registry.
            */
            onKeyDownCapture={(event) => {
              if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey)) return;
              event.stopPropagation();
              event.preventDefault();
              const trimmed = question.trim();
              if (trimmed === '' || streaming) return;
              onFollowUp(trimmed);
              setQuestion('');
            }}
            placeholder="Why is that O(n²)?"
            className="flex-1"
            disabled={streaming}
          />
          <Button type="submit" size="sm" disabled={streaming || question.trim() === ''}>
            Send
          </Button>
        </form>
      )}

      {empty && state.phase === 'idle' && (
        <p className="text-fg-subtle mt-3 text-xs">
          <Keys keys={SHORTCUTS.aiHelp.keys} />
          <span className="sr-only">{SHORTCUTS.aiHelp.keys.join('+')}</span> asks for help from
          anywhere in the workspace.
        </p>
      )}
    </div>
  );
}

/**
 * Memoised (ROADMAP P4-13).

 * It renders markdown, which is remark plus rehype plus the highlighter, and
 * nothing it shows changes while the user types in the editor.
 */
export const CoachPanel = memo(CoachPanelPanel);
