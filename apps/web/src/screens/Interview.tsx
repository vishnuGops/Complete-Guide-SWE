import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  STAGE_PROMPT,
  TOPIC_LABEL,
  type InterviewProblem,
  type InterviewStage,
} from '@devpromax/shared';
import { streamCoach } from '../api/coachStream.js';
import { useAdvanceInterview, useInterview, useStartInterview } from '../api/hooks.js';
import { PageHeader } from '../app/PageHeader.js';
import { Markdown } from '../markdown/Markdown.js';
import { formatClock } from './workspace/InterviewTimer.js';
import { Button, Card, CoachMark, ErrorState, Loading, Skeleton, cn } from '../ui/index.js';

/**
 * Mock interview (ROADMAP P9-1).
 *
 * Two problems, forty-five minutes, and an interviewer that asks for the
 * approach before the code. The coding happens in the workspace, where coding
 * happens; this screen is the person across the table.
 *
 * Deliberately not a modal over the workspace. An interview is a thing you are
 * *in* for three quarters of an hour, with its own clock and its own
 * conversation, and a dialog that has to be dismissed to write code is a dialog
 * that gets dismissed and never reopened.
 */

/**
 * Ticks the clock without asking the server every second.
 *
 * The remaining time comes from the server once, and this counts down from it.
 * Polling a route to watch a number go down would be a request a second for
 * arithmetic the browser can do - and the server's answer is authoritative
 * again on the next real interaction.
 */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1_000);
    return () => {
      clearInterval(timer);
    };
  }, [active]);

  return now;
}

/** The stages a sitting moves through, as the candidate sees them. */
const SHOWN_STAGES = ['approach', 'coding', 'review'] as const satisfies readonly InterviewStage[];
const STAGE_LABEL: Record<(typeof SHOWN_STAGES)[number], string> = {
  approach: 'Approach',
  coding: 'Code',
  review: 'Review',
};

function ProblemRow({
  problem,
  index,
  current,
}: {
  problem: InterviewProblem;
  index: number;
  current: boolean;
}) {
  const muted = current ? 'text-fg-muted' : 'text-fg-subtle';
  return (
    <li
      aria-current={current ? 'step' : undefined}
      className={cn(
        'border-border flex items-baseline gap-2 border-b border-l-2 py-2 pr-3 pl-2.5 last:border-b-0',
        current ? 'bg-surface-selected border-l-accent' : 'border-l-transparent',
      )}
    >
      {/*
        On the current row, secondary text is fg-muted: fg-subtle and the amber
        of "submitted" drop under 4.5:1 on the selected step (the a11y audit
        found it). The word still says the status; the colour is extra.
      */}
      <span className={cn('tnum text-xs', muted)}>{index + 1}</span>
      <Link
        to={`/problems/${problem.slug}`}
        className="focus-ring hover:text-accent-fg rounded-xs font-medium"
      >
        {problem.title}
      </Link>
      <span className={cn('text-xs', muted)}>
        {TOPIC_LABEL[problem.topic]} · {problem.tier}
      </span>
      <span
        className={cn(
          'ml-auto text-xs',
          current
            ? 'text-fg-muted'
            : problem.solved
              ? 'text-success-fg'
              : problem.attempted
                ? 'text-warn-fg'
                : 'text-fg-subtle',
        )}
      >
        {problem.solved ? 'accepted' : problem.attempted ? 'submitted' : 'not submitted'}
      </span>
    </li>
  );
}

export function Interview() {
  const { data, isPending, error, refetch } = useInterview();
  const start = useStartInterview();
  const advance = useAdvanceInterview();

  const [said, setSaid] = useState('');
  const [transcript, setTranscript] = useState<{ from: 'you' | 'them'; text: string }[]>([]);
  const [streaming, setStreaming] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const sitting = data?.interview ?? null;
  const live = sitting !== null && sitting.endedAt === null;
  const now = useNow(live);

  /**
   * One exchange, streamed.
   *
   * The same reader the Coach panel uses, so an interview turn cancels, reports
   * and costs exactly what a coaching turn does - including the spend cap and
   * the "no key" answer, which arrive as `skipped` events rather than as errors.
   */
  const send = useCallback(
    async (
      path: `/api/interview/${string}/say` | `/api/interview/${string}/finish`,
      text: string,
    ) => {
      setBusy(true);
      setFailure(null);
      setStreaming('');
      let reply = '';
      try {
        for await (const event of streamCoach(path, { message: text })) {
          if (event.type === 'markdown') {
            reply += event.delta;
            setStreaming(reply);
          } else if (event.type === 'error') {
            setFailure(event.message);
          } else if (event.type === 'skipped') {
            setFailure(
              event.reason === 'no_api_key'
                ? 'The interviewer needs an API key. Settings has the field.'
                : 'The spend cap for this conversation has been reached.',
            );
          }
        }
      } catch (streamError) {
        setFailure(streamError instanceof Error ? streamError.message : 'That turn failed.');
      } finally {
        setBusy(false);
        setStreaming('');
        if (reply !== '') setTranscript((before) => [...before, { from: 'them', text: reply }]);
        void refetch();
      }
    },
    [refetch],
  );

  const header = (
    <PageHeader
      title="Mock interview"
      context="Two problems, forty-five minutes, the approach before the code."
    />
  );

  // The header in every state (P9-7), so loading and failing still say where you are.
  if (isPending) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        {header}
        <Loading label="Loading the interview" className="max-w-3xl px-6">
          <span className="bg-surface border-border block rounded-xl border p-5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-4 h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-4/5" />
          </span>
        </Loading>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        {header}
        <div className="max-w-3xl px-6">
          <Card>
            <ErrorState
              className="p-0"
              title="The interview could not load."
              error={error}
              onRetry={() => {
                void refetch();
              }}
            />
          </Card>
        </div>
      </div>
    );
  }

  const left = sitting === null ? 0 : sitting.remainingMs - (now - Date.parse(sitting.createdAt));

  return (
    <div className="flex h-full min-h-0 flex-col">
      {header}

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
        <div className="flex max-w-3xl flex-col gap-4">
          {sitting === null || sitting.endedAt !== null ? (
            <>
              {sitting?.debrief != null && (
                <Card
                  title={
                    <span className="flex items-center gap-2">
                      <CoachMark />
                      Debrief
                    </span>
                  }
                >
                  <Markdown content={sitting.debrief} trust="coach" className="md-coach" />
                </Card>
              )}

              <Card className="max-w-xl">
                {/*
                 * Why there is no debrief, on the screen that has no debrief.
                 *
                 * Ending without a key, or over the cap, still ends the sitting -
                 * so the failure has to survive the switch to this branch, or the
                 * candidate presses the button and watches the interview vanish
                 * with no explanation at all.
                 */}
                {failure !== null && (
                  <p className="text-danger-fg mb-3 max-w-prose text-sm" role="alert">
                    {failure}
                  </p>
                )}

                <p className="text-fg-muted mb-4 max-w-prose text-sm">
                  The interviewer wants to hear how you would solve each problem before you write
                  it, and it will not give you the answer — that is the point of it. The problems
                  are two you have not solved; the clock starts when you do, and the coding happens
                  in the workspace, where coding happens.
                </p>
                <Button
                  variant="primary"
                  disabled={start.isPending}
                  onClick={() => {
                    setTranscript([]);
                    setFailure(null);
                    start.mutate();
                  }}
                >
                  {start.isPending ? 'Setting up…' : 'Start an interview'}
                </Button>
                {start.error && (
                  <p className="text-danger-fg mt-2 max-w-prose text-sm" role="alert">
                    {start.error.message}
                  </p>
                )}
              </Card>
            </>
          ) : (
            <>
              <Card
                title="This sitting"
                action={
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => {
                      void send(`/api/interview/${sitting.id}/finish`, '');
                    }}
                  >
                    End it and get the debrief
                  </Button>
                }
              >
                <div className="flex items-end gap-6">
                  <div>
                    <span
                      role="timer"
                      aria-live="off"
                      aria-label="Time remaining"
                      className={cn(
                        'tnum tracking-numeral text-2xl font-bold',
                        left <= 0 ? 'text-warn-fg' : 'text-fg',
                      )}
                    >
                      {formatClock(Math.max(0, left))}
                    </span>
                    <p className="text-fg-muted text-xs">left</p>
                  </div>

                  {/*
                    Where the sitting is, as a row of stages with the current
                    one filled: a display, not a control - the stage moves with
                    the button below, when the candidate says so.
                  */}
                  <ol
                    aria-label="Stage"
                    className="bg-surface-sunken border-border flex rounded-md border p-0.5"
                  >
                    {SHOWN_STAGES.map((stage) => (
                      <li
                        key={stage}
                        aria-current={stage === sitting.stage ? 'step' : undefined}
                        className={cn(
                          'rounded-sm px-2.5 py-1 text-xs font-medium',
                          stage === sitting.stage ? 'bg-accent text-fg-on-accent' : 'text-fg-muted',
                        )}
                      >
                        {STAGE_LABEL[stage]}
                      </li>
                    ))}
                  </ol>
                </div>

                <ul aria-label="The problems in this interview" className="mt-5">
                  {sitting.problems.map((problem, index) => (
                    <ProblemRow
                      key={problem.slug}
                      problem={problem}
                      index={index}
                      current={index === sitting.at}
                    />
                  ))}
                </ul>

                <div className="border-border mt-4 border-t pt-4">
                  <p className="text-fg-muted text-xs font-medium">Now</p>
                  <p className="text-fg mt-1 max-w-prose text-sm">{STAGE_PROMPT[sitting.stage]}</p>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-3"
                    disabled={advance.isPending || busy}
                    onClick={() => {
                      advance.mutate(sitting.id);
                    }}
                  >
                    {sitting.stage === 'approach'
                      ? 'I am ready to write it'
                      : sitting.stage === 'coding'
                        ? 'I have written it'
                        : 'Move on'}
                  </Button>
                </div>
              </Card>

              <Card title="The conversation">
                {transcript.length === 0 && streaming === '' && (
                  <p className="text-fg-muted text-sm">
                    Nothing said yet. Describe how you would solve the first problem.
                  </p>
                )}

                <div className="flex flex-col gap-4">
                  {transcript.map((line, index) =>
                    line.from === 'you' ? (
                      <div
                        key={`${line.from}-${String(index)}`}
                        className="border-border-strong border-l-2 pl-3"
                      >
                        <p className="text-fg-muted mb-1 text-xs font-medium">You</p>
                        <Markdown content={line.text} trust="coach" />
                      </div>
                    ) : (
                      <div key={`${line.from}-${String(index)}`}>
                        <p className="text-fg-muted mb-1 flex items-center gap-2 text-xs font-medium">
                          <CoachMark />
                          Interviewer
                        </p>
                        {/* The interviewer is the coach, so it speaks in the coach's serif. */}
                        <Markdown content={line.text} trust="coach" className="md-coach" />
                      </div>
                    ),
                  )}

                  {streaming !== '' && (
                    <div>
                      <p className="text-fg-muted mb-1 flex items-center gap-2 text-xs font-medium">
                        <CoachMark />
                        Interviewer
                      </p>
                      <Markdown content={streaming} trust="coach" className="md-coach" />
                    </div>
                  )}
                </div>

                {failure !== null && (
                  <p className="text-danger-fg mt-2 text-sm" role="alert">
                    {failure}
                  </p>
                )}

                <form
                  className="border-border mt-4 border-t pt-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const text = said.trim();
                    if (text === '' || busy) return;
                    setTranscript((before) => [...before, { from: 'you', text }]);
                    setSaid('');
                    void send(`/api/interview/${sitting.id}/say`, text);
                  }}
                >
                  <label htmlFor="interview-say" className="sr-only">
                    What you would say
                  </label>
                  <textarea
                    id="interview-say"
                    rows={4}
                    value={said}
                    disabled={busy}
                    placeholder="Say it the way you would out loud."
                    onChange={(event) => {
                      setSaid(event.target.value);
                    }}
                    className="focus-ring border-border-input bg-surface text-fg w-full resize-y rounded-md border p-2.5 text-sm"
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    className="mt-2"
                    disabled={busy || said.trim() === ''}
                  >
                    {busy ? 'Listening…' : 'Say it'}
                  </Button>
                </form>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
