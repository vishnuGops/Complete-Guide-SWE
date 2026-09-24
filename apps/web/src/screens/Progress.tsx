import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Award,
  BookOpen,
  CalendarClock,
  Flame,
  Lightbulb,
  MessagesSquare,
  Pencil,
  Play,
  type LucideIcon,
} from 'lucide-react';
import {
  LANGUAGE_LABEL,
  MAX_RUBRIC_SCORE,
  RUBRIC_DIMENSIONS,
  RUBRIC_LABEL,
  TOPIC_LABEL,
  VERDICTS,
  solvedCount,
  type ActiveDay,
  type DashboardResponse,
  type RecentActivity,
  type ReviewItem,
  type ReviewQueue,
  type Streak,
  type TopicSkill,
  type Verdict,
} from '@devpromax/shared';
import { useDashboard, useDownloadReport, useRecommendation } from '../api/hooks.js';
import { PageHeader } from '../app/PageHeader.js';
import {
  Button,
  Callout,
  Card,
  CoachMark,
  DeltaChip,
  ErrorState,
  IconTile,
  ListRow,
  Loading,
  SegmentBar,
  Segmented,
  Skeleton,
  Stat,
  VerdictTile,
  buttonClasses,
  cn,
} from '../ui/index.js';
import { coachBrief } from './progress/coachBrief.js';
import { calendarDaysAgo, localDay, relativeDay } from './relativeDay.js';
import { SolvedChart, cumulative, type ChartRange } from './progress/SolvedChart.js';

/**
 * Progress (ROADMAP P4-2 for the route, P7-5 for what is on it, P9-6 for how).
 *
 * The one screen that is a dashboard, laid out like the reference the owner
 * chose (docs/DESIGN.md 8): a wide Solved card with the number, its week and
 * its shape over time; the coach's brief beside it; then what happened, what
 * is due and where each topic stands; then the coach's marks, the streak and
 * the exportable report. Every card answers one question - there is no card
 * per number (DESIGN.md 3).
 *
 * Everything on screen comes from one payload, which is also what the export
 * is built from - so a number here and a number in a file someone sends to a
 * recruiter cannot disagree. The one exception is the suggested next problem,
 * which is the same recommendation the command palette gives.
 */

const DAY_MS = 86_400_000;

const RANGES = [
  { value: '1m', label: '1M' },
  { value: '3m', label: '3M' },
  { value: 'all', label: 'All' },
] as const;

const ACTIVITY_LABEL: Record<RecentActivity['kind'], string> = {
  run: 'Ran',
  submit: 'Submitted',
  coach_feedback: 'Asked the coach',
  hint_revealed: 'Took a hint',
  editorial_revealed: 'Opened the editorial',
  status_override: 'Changed the status',
};

const ACTIVITY_ICON: Record<Exclude<RecentActivity['kind'], 'submit'>, LucideIcon> = {
  run: Play,
  coach_feedback: MessagesSquare,
  hint_revealed: Lightbulb,
  editorial_revealed: BookOpen,
  status_override: Pencil,
};

/** How many recent events the card shows; the rest are in the report. */
const RECENT_ROWS = 6;

function isVerdict(value: string | null): value is Verdict {
  return value !== null && (VERDICTS as readonly string[]).includes(value);
}

/**
 * "3h ago", "yesterday", "12 Sep" - how long ago, not to the minute. Hours
 * only within today; from yesterday on it is the shared calendar-day wording
 * (P4-17), so ten at night and eight the next morning are not both "10h ago".
 */
function ago(iso: string, now = new Date()): string {
  if (calendarDaysAgo(iso, now) > 0) return relativeDay(iso, now);
  const minutes = Math.floor((now.getTime() - Date.parse(iso)) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${String(minutes)}m ago`;
  return `${String(Math.floor(minutes / 60))}h ago`;
}

/** First solves in the last seven days, today included. */
function thisWeek(solves: readonly ActiveDay[]): number {
  const since = utcDay(new Date(Date.parse(`${localDay()}T00:00:00.000Z`) - 6 * DAY_MS));
  return solves.filter((entry) => entry.day >= since).reduce((sum, entry) => sum + entry.count, 0);
}

// ---------------------------------------------------------------------------
// Solved
// ---------------------------------------------------------------------------

function SolvedCard({ data }: { data: DashboardResponse }) {
  // "All" starts at the first solve (at least a month), so the line opens on
  // the practice there is rather than on months of zero before it.
  const [range, setRange] = useState<ChartRange>('all');
  const points = useMemo(() => cumulative(data.solves, range), [data.solves, range]);
  const solved = solvedCount(data.byStatus);
  const week = thisWeek(data.solves);

  return (
    <Card
      title="Solved"
      className="col-span-2"
      action={
        <Segmented
          label="Chart range"
          size="sm"
          options={RANGES}
          value={range}
          onChange={setRange}
        />
      }
    >
      <Stat
        value={solved}
        label={`of ${String(data.total)} problems`}
        delta={
          <DeltaChip good={week > 0}>
            {week > 0 ? `+${String(week)} this week` : 'none this week'}
          </DeltaChip>
        }
      />
      <div className="mt-4">
        <SolvedChart points={points} />
      </div>

      <div className="border-border mt-5 grid grid-cols-3 gap-4 border-t pt-4">
        <SubStat icon={Award} value={data.byStatus.mastered} label="Mastered" />
        <SubStat icon={CalendarClock} value={data.reviews.due.length} label="Due for review" />
        <SubStat
          icon={Flame}
          value={data.streak.current}
          label={`Day${data.streak.current === 1 ? '' : 's'} in a row`}
        />
      </div>
    </Card>
  );
}

function SubStat({ icon: Icon, value, label }: { icon: LucideIcon; value: number; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <IconTile>
        <Icon size={16} strokeWidth={1.5} />
      </IconTile>
      <div>
        <p className="text-fg tnum text-lg leading-none font-semibold">{value}</p>
        <p className="text-fg-muted mt-1 text-xs">{label}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The coach's brief
// ---------------------------------------------------------------------------

function CoachBriefCard({ data }: { data: DashboardResponse }) {
  const brief = coachBrief(data);
  const { data: next } = useRecommendation(data.total > 0);

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <CoachMark />
          Coach brief
        </span>
      }
      className="flex flex-col"
    >
      {/* The coach's voice is the serif (DESIGN.md 5); the signals under it are the app's. */}
      <p className="text-fg tracking-title font-serif text-xl">{brief.headline}</p>
      {brief.signals.length > 0 && (
        <ul className="text-fg-muted mt-3 flex flex-col gap-1 text-xs">
          {brief.signals.map((signal) => (
            <li key={signal}>{signal}</li>
          ))}
        </ul>
      )}

      {next?.problem && (
        <Callout className="mt-auto pt-3">
          <p className="text-fg-muted text-xs">Suggested next</p>
          <p className="mt-0.5 text-sm font-semibold">{next.problem.title}</p>
          {/* The coach's reasoning, so its serif - as in the palette (DESIGN.md 5). */}
          <p className="text-fg-muted mt-1 font-serif text-sm">{next.reason}</p>
          <Link
            to={`/problems/${next.problem.slug}`}
            className={cn(buttonClasses('primary', 'sm'), 'mt-3')}
          >
            Open it
          </Link>
        </Callout>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// What happened, what is due, where each topic stands
// ---------------------------------------------------------------------------

function RecentCard({ recent }: { recent: readonly RecentActivity[] }) {
  return (
    <Card title="Recent activity">
      {recent.length === 0 ? (
        <p className="text-fg-muted text-sm">
          Nothing yet. Runs, submissions and coaching turns appear here as they happen.
        </p>
      ) : (
        <ul>
          {recent.slice(0, RECENT_ROWS).map((entry, index) => {
            const Icon = entry.kind === 'submit' ? null : ACTIVITY_ICON[entry.kind];
            return (
              <ListRow
                key={`${entry.at}-${String(index)}`}
                tile={
                  isVerdict(entry.verdict) ? (
                    <VerdictTile verdict={entry.verdict} />
                  ) : (
                    <IconTile size="sm">{Icon && <Icon size={12} strokeWidth={1.5} />}</IconTile>
                  )
                }
                title={
                  entry.slug !== null && entry.title !== null ? (
                    <Link
                      to={`/problems/${entry.slug}`}
                      className="focus-ring hover:text-accent-fg rounded-xs"
                    >
                      {entry.title}
                    </Link>
                  ) : (
                    <span className="text-fg-subtle font-normal">
                      a problem that is no longer here
                    </span>
                  )
                }
                meta={
                  <>
                    <span>{ACTIVITY_LABEL[entry.kind]}</span>
                    {entry.verdict !== null && <span> · {entry.verdict}</span>}
                    {entry.language !== null && <span> · {LANGUAGE_LABEL[entry.language]}</span>}
                  </>
                }
                value={ago(entry.at)}
              />
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/**
 * The review queue (ROADMAP P7-8).
 *
 * Two lists, and the second one matters as much as the first: a queue that only
 * shows what is due is a nag, and one that also shows what is coming is a
 * calendar. Each row says how many times it has been solved, because "review
 * this" without that is an instruction rather than a reason.
 */
function ReviewRow({ item, overdue }: { item: ReviewItem; overdue: boolean }) {
  const when = overdue
    ? item.overdueDays === 0
      ? 'due today'
      : `${String(item.overdueDays)} day${item.overdueDays === 1 ? '' : 's'} overdue`
    : `due ${new Date(item.dueAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}`;

  return (
    <ListRow
      tile={
        <IconTile size="sm">
          <CalendarClock size={12} strokeWidth={1.5} />
        </IconTile>
      }
      title={
        /* `?review=1` is what puts the workspace into review mode: hints and the
           editorial stay shut, because a review you can look up is not a review. */
        <Link
          to={`/problems/${item.slug}?review=1`}
          className="focus-ring hover:text-accent-fg rounded-xs"
        >
          {item.title}
        </Link>
      }
      meta={
        <>
          <span>{TOPIC_LABEL[item.topic]}</span> ·{' '}
          <span>
            {item.passes} pass{item.passes === 1 ? '' : 'es'}
          </span>
        </>
      }
      value={<span className={cn(overdue && 'text-warn-fg font-medium')}>{when}</span>}
    />
  );
}

function ReviewCard({ reviews }: { reviews: ReviewQueue }) {
  return (
    <Card title="Review queue">
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
        <details className="border-border mt-3 border-t pt-3">
          <summary className="text-fg-muted focus-ring cursor-pointer rounded-xs text-xs">
            {reviews.upcoming.length} coming up
          </summary>
          <ul className="mt-2">
            {reviews.upcoming.map((item) => (
              <ReviewRow key={item.slug} item={item} overdue={false} />
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}

/**
 * Where each topic stands (P4-8, re-drawn by P9-6).
 *
 * A segmented bar per topic, one segment per problem, so "3 of 14" is
 * countable and a four-problem topic does not look like a forty-problem one. A
 * topic with a review overdue is behind its schedule and says so in words as
 * well as in `warn`. Each name links into the list with that topic filtered,
 * because "Graph 0/14" is a prompt, and a prompt you cannot act on is just a
 * number.
 */
function TopicsCard({ data, wide }: { data: DashboardResponse; wide: boolean }) {
  const behind = new Set(data.reviews.due.map((item) => item.topic));

  return (
    <Card title="Topics" className={cn(wide && 'col-span-2')}>
      <ul className={cn('grid gap-x-6 gap-y-3', wide && 'grid-cols-2')}>
        {data.byTopic.map((row) => {
          const late = behind.has(row.topic);
          const percent = row.total === 0 ? 0 : Math.round((row.solved / row.total) * 100);
          return (
            <li key={row.topic}>
              <div className="flex items-baseline gap-2 text-sm">
                <Link
                  to={`/?topic=${row.topic}`}
                  className="focus-ring hover:text-accent-fg min-w-0 truncate rounded-xs"
                >
                  {TOPIC_LABEL[row.topic]}
                </Link>
                {late && <span className="text-warn-fg text-xs font-medium">behind</span>}
                <span className="text-fg-muted tnum ml-auto text-xs">
                  {row.solved}/{row.total} · {percent}%
                </span>
              </div>
              <SegmentBar
                className="mt-1.5"
                filled={row.solved}
                total={row.total}
                tone={late ? 'warn' : 'success'}
              />
            </li>
          );
        })}
      </ul>

      <p className="text-fg-muted border-border tnum mt-4 border-t pt-3 text-xs">
        {data.byTier.map((row, index) => (
          <span key={row.tier}>
            {index > 0 && ' · '}
            <Link to={`/?tier=${row.tier}`} className="focus-ring hover:text-accent-fg rounded-xs">
              {row.tier}
            </Link>{' '}
            {row.solved}/{row.total}
          </span>
        ))}
      </p>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// The coach's marks, the streak, the report
// ---------------------------------------------------------------------------

/**
 * Rubric averages per topic, weakest first (P7-5).
 *
 * The review count is on every row rather than in a footnote: an average taken
 * over one review is an anecdote, and a weakest topic chosen from anecdotes
 * sends someone off to practise the wrong thing.
 */
function SkillsCard({ skills }: { skills: readonly TopicSkill[] }) {
  return (
    <Card
      title="Weakest topics"
      description={`The coach's rubric marks per topic, out of ${String(MAX_RUBRIC_SCORE)}.`}
      className="col-span-2"
    >
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
              <tr className="border-border text-fg-muted border-b text-xs">
                <th scope="col" className="py-2 pr-3 text-left font-medium">
                  Topic
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Reviews
                </th>
                {RUBRIC_DIMENSIONS.map((dimension) => (
                  <th key={dimension} scope="col" className="px-3 py-2 text-right font-medium">
                    {RUBRIC_LABEL[dimension]}
                  </th>
                ))}
                <th scope="col" className="py-2 pl-3 text-right font-medium">
                  Average
                </th>
              </tr>
            </thead>
            <tbody>
              {skills.map((skill) => (
                <tr key={skill.topic} className="border-border border-b last:border-b-0">
                  <th scope="row" className="py-2 pr-3 text-left font-normal">
                    <Link
                      to={'/?topic=' + skill.topic}
                      className="focus-ring hover:text-accent-fg rounded-xs"
                    >
                      {TOPIC_LABEL[skill.topic]}
                    </Link>
                  </th>
                  <td className="text-fg-subtle tnum px-3 py-2 text-right text-xs">
                    {skill.samples}
                  </td>
                  {RUBRIC_DIMENSIONS.map((dimension) => (
                    <td key={dimension} className="text-fg-muted tnum px-3 py-2 text-right text-xs">
                      {(skill.scores[dimension] ?? 0).toFixed(1)}
                    </td>
                  ))}
                  <td className="tnum py-2 pl-3 text-right text-xs font-semibold">
                    {skill.average.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/** Weeks shown in the calendar: seventeen, about four months. */
const CALENDAR_WEEKS = 17;

function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * The last seventeen weeks, Sunday to Saturday, with today in the final column.
 *
 * Built here rather than sent: the server sends the active days only, because a
 * year of mostly-zeroes is not worth putting on a wire.
 */
function calendarCells(days: readonly ActiveDay[]): { day: string; count: number }[] {
  const counts = new Map(days.map((entry) => [entry.day, entry.count]));
  // Today is the local date (P7-11); the cells step through day labels as UTC
  // midnights, which is date arithmetic, not a time zone.
  const today = new Date(localDay() + 'T00:00:00.000Z');
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

/**
 * The streak, in words first (P7-5).
 *
 * The calendar is a picture of the sentence above it, so it is decoration as
 * far as a screen reader is concerned: a hundred and nineteen cells each saying
 * "no activity" would be worse than useless. Neutral rather than green -
 * activity is not a verdict, and green in this app means the judge said yes.
 */
function StreakCard({ streak }: { streak: Streak }) {
  const cells = calendarCells(streak.days);
  const today = localDay();
  const active = streak.days.length;

  return (
    <Card
      title="Streak"
      description={
        <>
          <span className="tnum text-fg font-medium">{streak.current}</span> day
          {streak.current === 1 ? '' : 's'} in a row. Longest{' '}
          <span className="tnum">{streak.longest}</span>; <span className="tnum">{active}</span>{' '}
          active day{active === 1 ? '' : 's'} in the last year.
        </>
      }
    >
      <div aria-hidden className="grid w-fit grid-flow-col grid-rows-7 gap-0.5">
        {cells.map((cell) => (
          <span
            key={cell.day}
            title={cell.day + ': ' + String(cell.count) + ' activity'}
            className={cn(
              'size-3 rounded-xs',
              cell.count === 0 && 'bg-border',
              cell.count > 0 && cell.count < 4 && 'bg-fg-subtle',
              cell.count >= 4 && 'bg-fg',
              cell.day > today && 'invisible',
            )}
          />
        ))}
      </div>
    </Card>
  );
}

/**
 * The exportable skills report (P7-5).
 *
 * Three formats of one thing, and none of them carries code, notes or anything
 * else the user wrote: a skills report is what someone can do, not what they
 * typed. The web page is one self-contained file, so it survives being emailed.
 */
function ExportCard() {
  const download = useDownloadReport();

  return (
    <Card
      title="Skills report"
      description="Everything on this page as a file to keep or send. No code and no notes."
    >
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
    </Card>
  );
}

// ---------------------------------------------------------------------------

/**
 * The cards, in their places, before the numbers arrive - under the real
 * header, which needs no numbers to say which page this is (P9-7).
 */
function ProgressSkeleton() {
  return (
    <Loading label="Loading progress" className="px-6 pb-6">
      {/*
        The grid on this span rather than on `Loading`: `Loading` wraps its
        children in one hidden span, so a grid there had a single cell and the
        two cards stacked in a third of the width (found by P9-7's capture).
      */}
      <span className="grid grid-cols-3 gap-4">
        <span className="bg-surface border-border col-span-2 block h-80 rounded-xl border p-5">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="mt-6 h-40 w-full" />
        </span>
        <span className="bg-surface border-border block h-80 rounded-xl border p-5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-4 h-5 w-full" />
          <Skeleton className="mt-2 h-5 w-4/5" />
        </span>
      </span>
    </Loading>
  );
}

export function Progress() {
  const { data, isPending, error, refetch } = useDashboard();

  /*
   * Loading and failing keep the page's header and its card (P9-7), as the
   * problem list does: the page says where you are before it says what went
   * wrong, and the header does not jump down when the answer arrives.
   */
  if (isPending || error) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <PageHeader title="Progress" />
        {isPending ? (
          <ProgressSkeleton />
        ) : (
          <div className="px-6 pb-6">
            <Card>
              <ErrorState
                className="p-0"
                title="Your progress could not load."
                error={error}
                onRetry={() => {
                  void refetch();
                }}
              />
            </Card>
          </div>
        )}
      </div>
    );
  }

  const solved = solvedCount(data.byStatus);
  const hasReviews = data.reviews.due.length > 0 || data.reviews.upcoming.length > 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title="Progress"
        context={
          <>
            {solved} of {data.total} problems solved.
            {data.driftedSolves > 0 && (
              /* Counted apart from the solved total, not deducted from it: the
                 work was done, and what changed is the bar (P7-9). */
              <> {data.driftedSolves} solved against tests that have since changed.</>
            )}
            {data.editorialsRevealed > 0 && (
              /* Said out loud rather than folded into the solved count: an
                 editorial you opened is not a problem you solved. */
              <>
                {' '}
                {data.editorialsRevealed} editorial
                {data.editorialsRevealed === 1 ? '' : 's'} opened before solving.
              </>
            )}
          </>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 max-[1279px]:px-4">
        {/*
          An empty catalogue reaches this screen as cards of nothing, which reads
          like a bug in the dashboard rather than an absence of problems. Say
          which it is (P4-10).
        */}
        {data.total === 0 ? (
          <Card>
            <p className="text-fg-muted text-sm">
              There are no problems to make progress through yet. Run{' '}
              <code className="font-mono">npm run problems:validate</code> to check the problem
              packages.
            </p>
          </Card>
        ) : (
          // `items-start`: a card sizes to its content (DESIGN.md 3), not to the
          // tallest card in its row.
          <div className="grid grid-cols-3 items-start gap-4 max-[1279px]:gap-3">
            <SolvedCard data={data} />
            <CoachBriefCard data={data} />

            <RecentCard recent={data.recent} />
            {/* No queue at all before anything is solved: an empty calendar is noise. */}
            {hasReviews && <ReviewCard reviews={data.reviews} />}
            <TopicsCard data={data} wide={!hasReviews} />

            <SkillsCard skills={data.skills} />
            <div className="flex flex-col gap-4 max-[1279px]:gap-3">
              <StreakCard streak={data.streak} />
              <ExportCard />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
