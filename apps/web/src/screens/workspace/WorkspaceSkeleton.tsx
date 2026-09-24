import { Loading, Skeleton } from '../../ui/index.js';

/**
 * The workspace, before it has a problem (ROADMAP P4-10).
 *
 * The three panels in their real proportions - statement left, editor right,
 * results below - because the alternative is a blank screen that becomes a
 * three-panel layout, and the eye has to find everything twice.
 *
 * A file of its own since the workspace became a lazy route (P4-18): this is
 * also what shows while that chunk downloads, so it has to be in the entry
 * bundle while the workspace is not.
 */
export function WorkspaceSkeleton() {
  return (
    <Loading
      label="Loading the problem"
      className="flex h-full min-h-0 flex-col gap-3 py-4 pr-4 pl-3"
    >
      <span className="flex h-8 shrink-0 items-center gap-2">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-6 w-16" />
        <Skeleton className="ml-auto h-6 w-32" />
      </span>
      <span className="flex min-h-0 flex-1 gap-3">
        <span className="bg-surface border-border w-2/5 shrink-0 rounded-xl border p-4">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="mt-4 h-3 w-full" />
          <Skeleton className="mt-2 h-3 w-full" />
          <Skeleton className="mt-2 h-3 w-4/5" />
        </span>
        <span className="bg-surface border-border flex-1 rounded-xl border p-4">
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="mt-2 h-3 w-2/3" />
          <Skeleton className="mt-2 h-3 w-1/3" />
        </span>
      </span>
    </Loading>
  );
}
