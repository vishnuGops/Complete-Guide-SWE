import { Link } from 'react-router-dom';
import {
  PROGRESS_LABEL,
  TOPIC_LABEL,
  solvedCount,
  type ProblemSummary,
  type ProgressStatus,
} from '@devpromax/shared';
import { useProblems } from '../api/hooks.js';
import { cn } from '../ui/index.js';

/**
 * The problem list (ROADMAP P4-1).
 *
 * A plain table, which is also what P4-4 will build: two hundred rows scanned by
 * eye want columns, not cards. What is missing here is filters, sorting and the
 * sticky header, all of which are P4-4 and P4-5.
 */

const STATUS_COLOUR: Record<ProgressStatus, string> = {
  not_started: 'text-fg-subtle',
  in_progress: 'text-accent-fg',
  solved: 'text-success-fg',
  mastered: 'text-success-fg',
};

/** Status is never carried by colour alone (docs/DESIGN.md section 6). */
function StatusCell({ status }: { status: ProgressStatus }) {
  return (
    <span className={cn('text-xs font-medium', STATUS_COLOUR[status])}>
      {PROGRESS_LABEL[status]}
    </span>
  );
}

function Row({ problem }: { problem: ProblemSummary }) {
  return (
    <tr className="border-border hover:bg-surface-sunken border-b">
      <td className="px-3 py-2">
        <StatusCell status={problem.status} />
      </td>
      <td className="px-3 py-2">
        <Link
          to={`/problems/${problem.slug}`}
          className="focus-ring hover:text-accent-fg rounded-xs font-medium"
        >
          {problem.title}
        </Link>
      </td>
      <td className="text-fg-muted px-3 py-2 text-xs">{TOPIC_LABEL[problem.topic]}</td>
      <td className="text-fg-muted px-3 py-2 text-xs">{problem.tier}</td>
      <td className="text-fg-muted tnum px-3 py-2 text-xs">{problem.rating}</td>
      <td className="text-fg-subtle px-3 py-2 text-xs">{problem.patterns.join(', ')}</td>
    </tr>
  );
}

export function ProblemList() {
  const { data, isPending, error } = useProblems();

  if (isPending) return <p className="text-fg-muted p-6 text-sm">Loading problems…</p>;
  if (error) return <p className="text-danger-fg p-6 text-sm">{error.message}</p>;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <header className="mb-6 flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">Problems</h1>
        <p className="text-fg-muted tnum text-sm">
          Solved {solvedCount(data.byStatus)} / {data.total}
        </p>
      </header>

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-border text-fg-muted border-b text-xs">
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Problem</th>
            <th className="px-3 py-2 font-medium">Topic</th>
            <th className="px-3 py-2 font-medium">Tier</th>
            <th className="px-3 py-2 font-medium">Rating</th>
            <th className="px-3 py-2 font-medium">Patterns</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((problem) => (
            <Row key={problem.slug} problem={problem} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
