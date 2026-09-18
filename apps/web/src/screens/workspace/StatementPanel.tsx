import type { ReactNode } from 'react';
import {
  LANGUAGE_LABEL,
  TOPIC_LABEL,
  VERDICT_LABEL,
  type ProblemDetail,
  type Submission,
} from '@devpromax/shared';
import { useSubmissions } from '../../api/hooks.js';
import { Markdown } from '../../markdown/Markdown.js';
import {
  Button,
  StickyTabsContent,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  cn,
} from '../../ui/index.js';
import { VERDICT_MARK, VERDICT_TONE } from './verdict.js';

/**
 * The left half of the workspace (ROADMAP P4-6).
 *
 * Five tabs, and each one is a different answer to "I am stuck": read the
 * problem again, take a hint, ask the coach, read how it is done, or look at
 * what you already tried. They are tabs rather than a scrolling column because
 * the panel is 400px wide and a hint the user has not asked for is a spoiler.
 *
 * Coach arrived with P5-3, and sits between Hints and Editorial on purpose:
 * that is its place on the ladder from "a nudge" to "the whole answer", and the
 * tab order is the only thing on screen that says so.
 *
 * Notes is still absent - there is no notes route in the API until P7-4, and a
 * tab that cannot save what you type into it is worse than no tab.
 */

function Hints({
  hints,
  revealed,
  onReveal,
}: {
  hints: readonly string[];
  revealed: number;
  onReveal: (revealed: number) => void;
}) {
  // Revealed one rung at a time; a ladder that unrolls itself the moment the
  // tab is opened would not be a ladder. The count is owned by `Workspace`
  // (P4-12): this panel is unmounted whenever another tab is shown, so keeping
  // it here meant looking at the Description un-revealed every hint. Persisting
  // reveals across sessions is still P7-1's.
  if (hints.length === 0) {
    return <p className="text-fg-muted p-4 text-sm">This problem has no hints.</p>;
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      {hints.slice(0, revealed).map((hint, index) => (
        <div key={hint} className="border-border rounded-md border px-3 py-2">
          <p className="text-fg-subtle mb-1 text-2xs font-medium tracking-wide uppercase">
            Hint {index + 1}
          </p>
          <Markdown content={hint} />
        </div>
      ))}

      {revealed < hints.length ? (
        <div>
          <Button
            onClick={() => {
              onReveal(revealed + 1);
            }}
          >
            {revealed === 0 ? 'Show the first hint' : 'Show the next hint'}
          </Button>
          <p className="text-fg-subtle mt-2 text-xs">
            {hints.length - revealed} of {hints.length} still hidden.
          </p>
        </div>
      ) : (
        <p className="text-fg-subtle text-xs">That is every hint for this problem.</p>
      )}
    </div>
  );
}

function Editorial({ problem }: { problem: ProblemDetail }) {
  if (!problem.editorialUnlocked || problem.editorial === null) {
    return (
      <div className="p-4">
        <p className="text-fg-muted text-sm">
          The editorial unlocks once you have solved this problem. Until then the hints are the way
          in — they go from a nudge to the full approach.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <Markdown content={problem.editorial} assetSlug={problem.summary.slug} />
    </div>
  );
}

function SubmissionRow({ submission }: { submission: Submission }) {
  return (
    <tr className="border-border border-b">
      <td className="px-3 py-1.5">
        <span className="flex items-center gap-2">
          <span
            aria-hidden
            className={cn('size-1.5 shrink-0 rounded-full', VERDICT_MARK[submission.verdict])}
          />
          <span className={cn('text-xs font-medium', VERDICT_TONE[submission.verdict])}>
            {VERDICT_LABEL[submission.verdict]}
          </span>
        </span>
      </td>
      <td className="text-fg-muted px-3 py-1.5 text-xs">{LANGUAGE_LABEL[submission.language]}</td>
      <td className="text-fg-muted tnum px-3 py-1.5 text-xs">
        {submission.passed}/{submission.total}
      </td>
      <td className="text-fg-subtle tnum px-3 py-1.5 text-xs">
        {new Date(submission.createdAt).toLocaleString(undefined, {
          dateStyle: 'short',
          timeStyle: 'short',
        })}
      </td>
    </tr>
  );
}

function Submissions({ slug }: { slug: string }) {
  const { data, isPending, error } = useSubmissions(slug);

  if (isPending) return <p className="text-fg-muted p-4 text-sm">Loading submissions…</p>;
  if (error) {
    return (
      <p className="text-danger-fg p-4 text-sm" role="alert">
        {error.message}
      </p>
    );
  }
  if (data.items.length === 0) {
    return (
      <p className="text-fg-muted p-4 text-sm">
        Nothing submitted yet. Run is for trying things; Submit is what gets recorded here.
      </p>
    );
  }

  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-border text-fg-muted border-b text-2xs">
          <th className="px-3 py-1.5 font-medium">Verdict</th>
          <th className="px-3 py-1.5 font-medium">Language</th>
          <th className="px-3 py-1.5 font-medium">Tests</th>
          <th className="px-3 py-1.5 font-medium">When</th>
        </tr>
      </thead>
      <tbody>
        {data.items.map((submission) => (
          <SubmissionRow key={submission.id} submission={submission} />
        ))}
      </tbody>
    </table>
  );
}

export interface StatementPanelProps {
  problem: ProblemDetail;
  /**
   * Controlled so AI Help can open the Coach tab from the toolbar. Without
   * this, pressing the button would start a turn on a tab the user cannot see.
   */
  tab: string;
  onTab: (tab: string) => void;
  /**
   * Hint rungs revealed so far, owned by the workspace (P4-12).
   *
   * Here rather than in the Hints panel because Radix unmounts an inactive
   * panel - so a glance at the Description used to hide every hint again - and
   * because the count is what the coach has to be told (P7-1).
   */
  revealedHints: number;
  onRevealHint: (revealed: number) => void;
  coach: ReactNode;
}

export function StatementPanel({
  problem,
  tab,
  onTab,
  revealedHints,
  onRevealHint,
  coach,
}: StatementPanelProps) {
  const { summary } = problem;

  return (
    <Tabs value={tab} onValueChange={onTab} className="flex min-h-0 w-full flex-col">
      {/*
        Above the tabs, not inside Description. Which problem you are looking at
        is not a fact about one tab: on Hints or Submissions the title would
        otherwise disappear, and the only thing left on screen naming the problem
        would be the browser's URL.
      */}
      <div className="border-border shrink-0 border-b px-4 py-2">
        <h1 className="text-lg font-semibold">{summary.title}</h1>
        <p className="text-fg-subtle mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
          <span>{summary.tier}</span>
          <span aria-hidden>·</span>
          <span className="tnum">rating {summary.rating}</span>
          <span aria-hidden>·</span>
          <span>{TOPIC_LABEL[summary.topic]}</span>
          {summary.patterns.length > 0 && (
            <>
              <span aria-hidden>·</span>
              <span>{summary.patterns.join(', ')}</span>
            </>
          )}
        </p>
      </div>

      <TabsList className="shrink-0 px-2">
        <TabsTrigger value="description">Description</TabsTrigger>
        <TabsTrigger value="hints">Hints</TabsTrigger>
        <TabsTrigger value="coach">Coach</TabsTrigger>
        <TabsTrigger value="editorial">Editorial</TabsTrigger>
        <TabsTrigger value="submissions">
          Submissions
          {problem.submissionCount > 0 && (
            <span className="text-fg-subtle tnum ml-1 text-2xs">{problem.submissionCount}</span>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="description" className="min-h-0 flex-1 overflow-y-auto pt-0">
        <div className="p-4">
          <Markdown content={problem.statement} assetSlug={summary.slug} />

          {problem.targetComplexity && (
            <p className="text-fg-muted border-border mt-6 border-t pt-3 text-xs">
              Target complexity: <code className="font-mono">{problem.targetComplexity.time}</code>{' '}
              time, <code className="font-mono">{problem.targetComplexity.space}</code> space.
            </p>
          )}
        </div>
      </TabsContent>

      <TabsContent value="hints" className="min-h-0 flex-1 overflow-y-auto pt-0">
        <Hints hints={problem.hints} revealed={revealedHints} onReveal={onRevealHint} />
      </TabsContent>

      {/*
        Kept mounted: it holds a half-typed question and a streaming answer, and
        both used to be thrown away by a glance at the Description (P4-12).
      */}
      <StickyTabsContent value="coach" className="min-h-0 flex-1 overflow-y-auto pt-0">
        {coach}
      </StickyTabsContent>

      <TabsContent value="editorial" className="min-h-0 flex-1 overflow-y-auto pt-0">
        <Editorial problem={problem} />
      </TabsContent>

      <TabsContent value="submissions" className="min-h-0 flex-1 overflow-y-auto pt-0">
        <Submissions slug={summary.slug} />
      </TabsContent>
    </Tabs>
  );
}
