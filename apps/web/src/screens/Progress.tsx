import { Link } from 'react-router-dom';
import {
  MAX_RUBRIC_SCORE,
  PROGRESS_LABEL,
  PROGRESS_STATUSES,
  RUBRIC_DIMENSIONS,
  RUBRIC_LABEL,
  TOPIC_LABEL,
  solvedCount,
  type ActiveDay,
  type RecentActivity,
  type ReviewItem,
  type ReviewQueue,
  type Streak,
  type TierCount,
  type TopicCount,
  type TopicSkill,
} from '@devpromax/shared';
import { useDashboard, useDownloadReport } from '../api/hooks.js';
import { Button, ErrorState, Loading, Skeleton, cn } from '../ui/index.js';

/**
 * Progress (ROADMAP P4-2 for the route).
 *
 * Completed by P7-5: the counts per topic and tier, plus the streak calendar,
 * the recent activity, the weakest topics as the coach scored them, and the
 * exportable skills report. Everything on screen comes from one payload, which
 * is also what the export is built from - so a number here and a number in a
 * file someone sends to a recruiter cannot disagree.
 *
 * Each row links into the list with that topic already filtered, because
 * "Graph 0/14" is a prompt, and a prompt you cannot act on is just a number.
 */

function Bar({ label, solved, total }: { label: string; solved: number; total: number }) {
  const percent = total === 0 ? 0 : Math.round((solved / total) * 100);
  return (
    <span
      className="bg-surface-sunken border-border block h-1.5 w-full overflow-hidden rounded-xs border"
      role="progressbar"
      // A progressbar with a value and no name is a number with nothing to be
      // the number *of*; the row header says it on screen but a bar read on its
      // own has to carry it too (P4-10, axe `aria-progressbar-name`).
      aria-label={`${label} solved`}
      aria-valuenow={solved}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuetext={`${String(solved)} of ${String(total)}`}
    >
      <span className="bg-success block h-full" style={{ width: `${String(percent)}%` }} />
    </span>
  );
}

function GroupRow({ label, to, row }: { label: string; to?: string; row: TopicCount | TierCount }) {
  return (
    <tr className="border-border border-b">
      {/* The row's header cell: what the bar and the counts beside it are about. */}
      <th scope="row" className="w-44 px-3 py-1.5 text-left text-sm font-normal">
        {to ? (
          <Link to={to} className="focus-ring hover:text-accent-fg rounded-xs">
            {label}
          </Link>
        ) : (
          label
        )}
      </th>
      <td className="px-3 py-1.5">
        <Bar label={label} solved={row.solved} total={row.total} />
      </td>
      <td className="text-fg-muted tnum w-20 px-3 py-1.5 text-right text-xs">
        {row.solved}/{row.total}
      </td>
      <td className="text-fg-subtle tnum w-28 px-3 py-1.5 text-right text-xs">
        {row.mastered > 0 && `${String(row.mastered)} mastered`}
      </td>
    </tr>
  );
}

/** Weeks shown in the calendar. Seventeen fits the width without scrolling. */
const CALENDAR_WEEKS = 17;

const ACTIVITY_LABEL: Record<RecentActivity['kind'], string> = {
  run: 'Ran',
  submit: 'Submitted',
  coach_feedback: 'Asked the coach about',
  hint_revealed: 'Took a hint on',
  editorial_revealed: 'Opened the editorial for',
  status_override: 'Changed the status of',
};

function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * The last seventeen weeks, Sunday to Saturday, with today in the final column.
 *
 * Built here rather than sent: the server sends the active days only, because a
 * year of mostly-zeroes is not worth putting on a wire, and the empty squares
 * between them are a fact about the calendar rather than about the user.
 */
function calendarCells(days: readonly ActiveDay[]): { day: string; count: number }[] {
  const counts = new Map(days.map((entry) => [entry.day, entry.count]));
  const today = new Date(utcDay(new Date()) + 'T00:00:00.000Z');

  const end = new Date(today);
  end.setUTCDate(end.getUTCDate() + (6 - end.getUTCDay()));
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (CALENDAR_WEEKS * 7 - 1));

  const cells: { day: string; count: number }[] = [];
  for (const cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const day = utcDay(cursor);
    cells.push({ day, count: counts.get(day) ?? 0 });
  }
  return cells;
}

function StreakCalendar({ streak }: { streak: Streak }) {
  const cells = calendarCells(streak.days);
  const today = utcDay(new Date());
  const active = streak.days.length;

  return (
    <section className="mb-8">
      <h2 className="text-fg-subtle mb-2 text-2xs font-medium tracking-wide uppercase">Streak</h2>
      <p className="text-fg-muted text-sm">
        <span className="tnum text-fg font-medium">{streak.current}</span> day
        {streak.current === 1 ? '' : 's'} in a row. Longest{' '}
        <span className="tnum">{streak.longest}</span>; <span className="tnum">{active}</span>{' '}
        active day{active === 1 ? '' : 's'} in the last year.
      </p>

      {/*
        A picture of the sentence above it, so it is decoration as far as a
        screen reader is concerned: a hundred and nineteen list items each
        saying "no activity" would be worse than useless. Each square keeps a
        `title` for a mouse.
      */}
      <div
        aria-hidden
        className="mt-3 grid grid-flow-col grid-rows-7 gap-0.5"
        style={{ gridTemplateColumns: 'repeat(' + String(CALENDAR_WEEKS) + ', minmax(0, 1fr))' }}
      >
        {cells.map((cell) => (
          <span
            key={cell.day}
            title={cell.day + ': ' + String(cell.count) + ' activity'}
            className={cn(
              'aspect-square rounded-xs',
              cell.count === 0 && 'bg-surface-sunken',
              cell.count > 0 && cell.count < 4 && 'bg-success opacity-45',
              cell.count >= 4 && 'bg-success',
              cell.day > today && 'opacity-0',
              cell.day === today && 'ring-border-strong ring-1',
            )}
          />
        ))}
      </div>
    </section>
  );
}

/**
 * Rubric averages per topic, weakest first (P7-5).
 *
 * The review count is on every row rather than in a footnote: an average taken
 * over one review is an anecdote, and a weakest topic chosen from anecdotes
 * sends someone off to practise the wrong thing.
 */
function Skills({ skills }: { skills: readonly TopicSkill[] }) {
  return (
    <section className="mb-8">
      <h2 className="text-fg-subtle mb-2 text-2xs font-medium tracking-wide uppercase">
        Weakest topics
      </h2>

      {skills.length === 0 ? (
        <p className="text-fg-muted text-sm">
          Nothing scored yet. These are the coach&rsquo;s rubric marks, so they appear once you have
          asked it to review something.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">
              Average coach rubric score per topic, out of {MAX_RUBRIC_SCORE}, weakest first
            </caption>
            <thead>
              <tr className="border-border text-fg-muted border-b text-2xs">
                <th scope="col" className="px-3 py-1.5 text-left font-medium">
                  Topic
                </th>
                <th scope="col" className="px-3 py-1.5 text-right font-medium">
                  Reviews
                </th>
                {RUBRIC_DIMENSIONS.map((dimension) => (
                  <th key={dimension} scope="col" className="px-3 py-1.5 text-right font-medium">
                    {RUBRIC_LABEL[dimension]}
                  </th>
                ))}
                <th scope="col" className="px-3 py-1.5 text-right font-medium">
                  Average
                </th>
              </tr>
            </thead>
            <tbody>
              {skills.map((skill) => (
                <tr key={skill.topic} className="border-border border-b">
                  <th scope="row" className="px-3 py-1.5 text-left font-normal">
                    <Link
                      to={'/?topic=' + skill.topic}
                      className="focus-ring hover:text-accent-fg rounded-xs"
                    >
                      {TOPIC_LABEL[skill.topic]}
                    </Link>
                  </th>
                  <td className="text-fg-subtle tnum px-3 py-1.5 text-right text-xs">
                    {skill.samples}
                  </td>
                  {RUBRIC_DIMENSIONS.map((dimension) => (
                    <td
                      key={dimension}
                      className="text-fg-muted tnum px-3 py-1.5 text-right text-xs"
                    >
                      {(skill.scores[dimension] ?? 0).toFixed(1)}
                    </td>
                  ))}
                  <td className="tnum px-3 py-1.5 text-right text-xs font-medium">
                    {skill.average.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Recent({ recent }: { recent: readonly RecentActivity[] }) {
  if (recent.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="text-fg-subtle mb-2 text-2xs font-medium tracking-wide uppercase">
        Recent activity
      </h2>
      <ul className="text-sm">
        {recent.map((entry, index) => (
          <li
            key={entry.at + '-' + String(index)}
            className="border-border flex items-baseline gap-2 border-b py-1.5 last:border-b-0"
          >
            <span className="text-fg-muted">{ACTIVITY_LABEL[entry.kind]}</span>
            {entry.slug !== null && entry.title !== null ? (
              <Link
                to={'/problems/' + entry.slug}
                className="focus-ring hover:text-accent-fg rounded-xs font-medium"
              >
                {entry.title}
              </Link>
            ) : (
              <span className="text-fg-subtle">a problem that is no longer here</span>
            )}
            {entry.verdict !== null && (
              <span className="text-fg-subtle text-xs">{entry.verdict}</span>
            )}
            <span className="text-fg-subtle tnum ml-auto text-xs">
              {new Date(entry.at).toLocaleString(undefined, {
                dateStyle: 'short',
                timeStyle: 'short',
              })}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The exportable skills report (P7-5).
 *
 * Three formats of one thing, and none of them carries code, notes or anything
 * else the user wrote: a skills report is what someone can do, not what they
 * typed. The web page is one self-contained file, so it survives being emailed.
 */
function Export() {
  const download = useDownloadReport();

  return (
    <section className="border-border mb-8 border-t pt-5">
      <h2 className="text-fg-subtle mb-2 text-2xs font-medium tracking-wide uppercase">
        Skills report
      </h2>
      <p className="text-fg-muted mb-3 text-sm">
        Everything above as a file to keep or send. No code and no notes: only what you have solved
        and how it was scored.
      </p>
      <div className="flex flex-wrap gap-2">
        {(
          [
            ['markdown', 'Markdown'],
            ['html', 'Web page'],
            ['json', 'JSON'],
          ] as const
        ).map(([format, label]) => (
          <Button
            key={format}
            size="sm"
            variant="secondary"
            disabled={download.isPending}
            onClick={() => {
              download.mutate(format);
            }}
          >
            {label}
          </Button>
        ))}
      </div>
      {download.error && (
        <p className="text-danger-fg mt-2 text-sm" role="alert">
          {download.error.message}
        </p>
      )}
    </section>
  );
}

/**
 * The review queue (ROADMAP P7-8).
 *
 * Two lists, and the second one matters as much as the first: a queue that only
 * shows what is due is a nag, and one that also shows what is coming is a
 * calendar. Each row says how long ago it was last solved and how many times it
 * has been, because "review this" without that is an instruction rather than a
 * reason.
 */
function ReviewRow({ item, overdue }: { item: ReviewItem; overdue: boolean }) {
  const when = overdue
    ? item.overdueDays === 0
      ? 'due today'
      : `${String(item.overdueDays)} day${item.overdueDays === 1 ? '' : 's'} overdue`
    : `due ${new Date(item.dueAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}`;

  return (
    <li className="border-border flex items-baseline gap-2 border-b py-1.5 text-sm last:border-b-0">
      {/*
        `?review=1` is what puts the workspace into review mode: hints and the
        editorial stay shut, because a review you can look up is not a review.
      */}
      <Link
        to={`/problems/${item.slug}?review=1`}
        className="focus-ring hover:text-accent-fg rounded-xs font-medium"
      >
        {item.title}
      </Link>
      <span className="text-fg-subtle text-xs">{TOPIC_LABEL[item.topic]}</span>
      <span className="text-fg-subtle tnum text-xs">
        {item.passes} pass{item.passes === 1 ? '' : 'es'}
      </span>
      <span className={cn('tnum ml-auto text-xs', overdue ? 'text-warn-fg' : 'text-fg-subtle')}>
        {when}
      </span>
    </li>
  );
}

function Reviews({ reviews }: { reviews: ReviewQueue }) {
  if (reviews.due.length === 0 && reviews.upcoming.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="text-fg-subtle mb-2 text-2xs font-medium tracking-wide uppercase">
        Review queue
      </h2>

      {reviews.due.length === 0 ? (
        <p className="text-fg-muted text-sm">
          Nothing due. The queue fills up as what you have solved gets older.
        </p>
      ) : (
        <ul>
          {reviews.due.map((item) => (
            <ReviewRow key={item.slug} item={item} overdue />
          ))}
        </ul>
      )}

      {reviews.upcoming.length > 0 && (
        <details className="mt-3">
          <summary className="text-fg-muted focus-ring cursor-pointer rounded-xs text-xs">
            {reviews.upcoming.length} coming up
          </summary>
          <ul className="mt-1">
            {reviews.upcoming.map((item) => (
              <ReviewRow key={item.slug} item={item} overdue={false} />
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

/** Two tables' worth of rows, at the height they will be when they arrive. */
function ProgressSkeleton() {
  return (
    <Loading label="Loading progress" className="mx-auto max-w-3xl px-6 py-6">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="mt-2 h-4 w-56" />
      <span className="mt-8 block">
        {Array.from({ length: 6 }, (_, index) => (
          <span key={index} className="flex items-center gap-3 py-2">
            <Skeleton className="h-3 w-44" />
            <Skeleton className="h-1.5 flex-1" />
            <Skeleton className="h-3 w-12" />
          </span>
        ))}
      </span>
    </Loading>
  );
}

export function Progress() {
  const { data, isPending, error, refetch } = useDashboard();

  if (isPending) return <ProgressSkeleton />;
  if (error) {
    return (
      <ErrorState
        title="Your progress could not load."
        error={error}
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }

  const solved = solvedCount(data.byStatus);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-6">
        <header className="mb-6">
          <h1 className="text-xl font-semibold">Progress</h1>
          <p className="text-fg-muted tnum mt-1 text-sm">
            {solved} of {data.total} problems solved.
            {data.editorialsRevealed > 0 && (
              /* Said out loud rather than folded into the solved count: an
                 editorial you opened is not a problem you solved. */
              <>
                {' '}
                {data.editorialsRevealed} editorial
                {data.editorialsRevealed === 1 ? '' : 's'} opened before solving.
              </>
            )}
          </p>
        </header>

        {/*
          An empty catalogue reaches this screen as three sections of nothing,
          which reads like a bug in the dashboard rather than an absence of
          problems. Say which it is (P4-10).
        */}
        {data.total === 0 && (
          <p className="text-fg-muted text-sm">
            There are no problems to make progress through yet. Run{' '}
            <code className="font-mono">npm run problems:validate</code> to check the problem
            packages.
          </p>
        )}

        {data.total > 0 && (
          <>
            <StreakCalendar streak={data.streak} />

            <section className="mb-8">
              <h2 className="text-fg-subtle mb-2 text-2xs font-medium tracking-wide uppercase">
                By status
              </h2>
              <ul className="flex flex-wrap gap-x-6 gap-y-1">
                {PROGRESS_STATUSES.map((status) => (
                  <li key={status} className="text-sm">
                    <span
                      className={cn(
                        'tnum font-medium',
                        status === 'not_started' && 'text-fg-subtle',
                        status === 'in_progress' && 'text-accent-fg',
                        status !== 'not_started' && status !== 'in_progress' && 'text-success-fg',
                      )}
                    >
                      {data.byStatus[status]}
                    </span>{' '}
                    <span className="text-fg-muted">{PROGRESS_LABEL[status]}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-fg-subtle mb-2 text-2xs font-medium tracking-wide uppercase">
                By topic
              </h2>
              <table className="w-full table-fixed">
                <caption className="sr-only">Problems solved in each curriculum topic</caption>
                <tbody>
                  {data.byTopic.map((row) => (
                    <GroupRow
                      key={row.topic}
                      label={TOPIC_LABEL[row.topic]}
                      to={`/?topic=${row.topic}`}
                      row={row}
                    />
                  ))}
                </tbody>
              </table>
            </section>

            <section className="mb-8">
              <h2 className="text-fg-subtle mb-2 text-2xs font-medium tracking-wide uppercase">
                By difficulty
              </h2>
              <table className="w-full table-fixed">
                <caption className="sr-only">Problems solved at each difficulty tier</caption>
                <tbody>
                  {data.byTier.map((row) => (
                    <GroupRow key={row.tier} label={row.tier} to={`/?tier=${row.tier}`} row={row} />
                  ))}
                </tbody>
              </table>
            </section>

            <Reviews reviews={data.reviews} />
            <Skills skills={data.skills} />
            <Recent recent={data.recent} />
            <Export />
          </>
        )}
      </div>
    </div>
  );
}
