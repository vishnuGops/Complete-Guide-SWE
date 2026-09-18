import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { STAGE_PROMPT, TOPIC_LABEL, type InterviewProblem } from '@devpromax/shared';
import { streamCoach } from '../api/coachStream.js';
import { useAdvanceInterview, useInterview, useStartInterview } from '../api/hooks.js';
import { Markdown } from '../markdown/Markdown.js';
import { formatClock } from './workspace/InterviewTimer.js';
import { Button, ErrorState, Loading, Skeleton, cn } from '../ui/index.js';

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

function ProblemRow({
  problem,
  index,
  current,
}: {
  problem: InterviewProblem;
  index: number;
  current: boolean;
}) {
  return (
    <li
      className={cn(
        'border-border flex items-baseline gap-2 border-b py-2 last:border-b-0',
        current && 'bg-surface-sunken -mx-3 px-3',
      )}
    >
      <span className="text-fg-subtle tnum text-xs">{index + 1}</span>
      <Link
        to={`/problems/${problem.slug}`}
        className="focus-ring hover:text-accent-fg rounded-xs font-medium"
      >
        {problem.title}
      </Link>
      <span className="text-fg-subtle text-xs">
        {TOPIC_LABEL[problem.topic]} · {problem.tier}
      </span>
      <span
        className={cn(
          'ml-auto text-xs',
          problem.solved
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

  if (isPending) {
    return (
      <Loading label="Loading the interview" className="mx-auto max-w-3xl px-6 py-6">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="mt-3 h-4 w-full" />
      </Loading>
    );
  }
  if (error) {
    return (
      <ErrorState
        title="The interview could not load."
        error={error}
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-6">
        <header className="mb-6">
          <h1 className="text-xl font-semibold">Mock interview</h1>
          <p className="text-fg-muted mt-1 max-w-prose text-sm">
            Two problems, forty-five minutes, and an interviewer who wants to hear the approach
            before the code. It will not give you the answer — that is the point of it.
          </p>
        </header>

        {sitting === null || sitting.endedAt !== null ? (
          <>
            {sitting?.debrief != null && (
              <section className="mb-8">
                <h2 className="text-fg-subtle mb-2 text-2xs font-medium tracking-wide uppercase">
                  Debrief
                </h2>
                <Markdown content={sitting.debrief} trust="coach" />
              </section>
            )}

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

            <Button
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
          </>
        ) : (
          <>
            <section className="mb-6 flex items-baseline gap-3">
              <span
                role="timer"
                aria-live="off"
                aria-label="Time remaining"
                className={cn(
                  'tnum text-lg font-semibold',
                  sitting.remainingMs - (now - Date.parse(sitting.createdAt)) <= 0
                    ? 'text-warn-fg'
                    : 'text-fg',
                )}
              >
                {formatClock(
                  Math.max(0, sitting.remainingMs - (now - Date.parse(sitting.createdAt))),
                )}
              </span>
              <span className="text-fg-muted text-sm">left</span>
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto"
                disabled={busy}
                onClick={() => {
                  void send(`/api/interview/${sitting.id}/finish`, '');
                }}
              >
                End it and get the debrief
              </Button>
            </section>

            <section className="mb-6">
              <h2 className="text-fg-subtle mb-2 text-2xs font-medium tracking-wide uppercase">
                The problems
              </h2>
              <ul aria-label="The problems in this interview">
                {sitting.problems.map((problem, index) => (
                  <ProblemRow
                    key={problem.slug}
                    problem={problem}
                    index={index}
                    current={index === sitting.at}
                  />
                ))}
              </ul>
            </section>

            <section className="mb-6">
              <h2 className="text-fg-subtle mb-1 text-2xs font-medium tracking-wide uppercase">
                Now
              </h2>
              <p className="text-fg max-w-prose text-sm">{STAGE_PROMPT[sitting.stage]}</p>
              <Button
                size="sm"
                variant="secondary"
                className="mt-2"
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
            </section>

            <section className="mb-6">
              <h2 className="text-fg-subtle mb-2 text-2xs font-medium tracking-wide uppercase">
                The conversation
              </h2>

              {transcript.length === 0 && streaming === '' && (
                <p className="text-fg-muted text-sm">
                  Nothing said yet. Describe how you would solve the first problem.
                </p>
              )}

              <div className="flex flex-col gap-3">
                {transcript.map((line, index) => (
                  <div
                    key={`${line.from}-${String(index)}`}
                    className={cn(
                      'rounded-md px-3 py-2 text-sm',
                      line.from === 'you' ? 'bg-surface-sunken' : 'border-border border',
                    )}
                  >
                    <p className="text-fg-subtle mb-1 text-2xs font-medium tracking-wide uppercase">
                      {line.from === 'you' ? 'You' : 'Interviewer'}
                    </p>
                    <Markdown content={line.text} trust="coach" />
                  </div>
                ))}

                {streaming !== '' && (
                  <div className="border-border rounded-md border px-3 py-2 text-sm">
                    <p className="text-fg-subtle mb-1 text-2xs font-medium tracking-wide uppercase">
                      Interviewer
                    </p>
                    <Markdown content={streaming} trust="coach" />
                  </div>
                )}
              </div>

              {failure !== null && (
                <p className="text-danger-fg mt-2 text-sm" role="alert">
                  {failure}
                </p>
              )}

              <form
                className="mt-3"
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
                  className="focus-ring border-border bg-surface text-fg w-full resize-y rounded-md border p-2 text-sm"
                />
                <Button type="submit" className="mt-2" disabled={busy || said.trim() === ''}>
                  {busy ? 'Listening…' : 'Say it'}
                </Button>
              </form>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
