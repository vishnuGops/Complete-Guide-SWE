import { Link } from 'react-router-dom';
import {
  PROGRESS_LABEL,
  PROGRESS_STATUSES,
  TOPIC_LABEL,
  solvedCount,
  type TierCount,
  type TopicCount,
} from '@devpromax/shared';
import { useProgress } from '../api/hooks.js';
import { cn } from '../ui/index.js';

/**
 * Progress (ROADMAP P4-2 for the route).
 *
 * What the API can already answer: how much of each topic and each tier is
 * done. The dashboard the roadmap describes - streak calendar, recent activity,
 * weakest topics from the coach's rubric scores, and the exportable skills
 * report - is P7-5, and every one of those needs something that does not exist
 * yet (the events table is written but unread, the rubric scores arrive with the
 * coach).
 *
 * Each row links into the list with that topic already filtered, because
 * "Graph 0/14" is a prompt, and a prompt you cannot act on is just a number.
 */

function Bar({ solved, total }: { solved: number; total: number }) {
  const percent = total === 0 ? 0 : Math.round((solved / total) * 100);
  return (
    <span
      className="bg-surface-sunken border-border block h-1.5 w-full overflow-hidden rounded-xs border"
      role="progressbar"
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
      <td className="w-44 px-3 py-1.5 text-sm">
        {to ? (
          <Link to={to} className="focus-ring hover:text-accent-fg rounded-xs">
            {label}
          </Link>
        ) : (
          label
        )}
      </td>
      <td className="px-3 py-1.5">
        <Bar solved={row.solved} total={row.total} />
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

export function Progress() {
  const { data, isPending, error } = useProgress();

  if (isPending) return <p className="text-fg-muted p-6 text-sm">Loading progress…</p>;
  if (error) {
    return (
      <p className="text-danger-fg p-6 text-sm" role="alert">
        {error.message}
      </p>
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
          </p>
        </header>

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

        <section>
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
      </div>
    </div>
  );
}
