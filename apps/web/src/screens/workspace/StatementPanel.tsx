import { memo, useState, type ReactNode } from 'react';
import {
  LANGUAGES,
  LANGUAGE_LABEL,
  TOPIC_LABEL,
  VERDICT_LABEL,
  type Language,
  type ProblemDetail,
  type Submission,
} from '@devpromax/shared';
import { useRevealEditorial, useSubmissions } from '../../api/hooks.js';
import { Markdown } from '../../markdown/Markdown.js';
import {
  Button,
  ConfirmDialog,
  StickyTabsContent,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  cn,
} from '../../ui/index.js';
import { CodeDiff } from './CodeDiff.js';
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
  // it here meant looking at the Description un-revealed every hint. `Workspace`
  // also seeds it from the server and records each reveal, so a rung stays open
  // across a reload (P7-1).
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

/**
 * The reference solution, and optionally the difference between it and the
 * editor (ROADMAP P7-2).
 *
 * The language starts on whichever one the user is writing in - they came here
 * to compare, and having to pick their own language first is a step for
 * nothing - but both are always one click away, because reading the same
 * approach in the other language is one of the better things this app can
 * offer.
 */
function ReferenceSolution({
  references,
  language,
  code,
}: {
  references: Record<Language, string>;
  language: Language;
  code: string;
}) {
  const [shown, setShown] = useState<Language>(language);
  const [comparing, setComparing] = useState(false);
  const reference = references[shown];

  return (
    /* Labelled, so it is a landmark: the language buttons in here read
       identically to the ones in the workspace toolbar, and without a region
       around them nothing on screen says which pair does which. */
    <section aria-label="Reference solution" className="border-border mt-6 border-t pt-4">
      <h2 className="text-sm font-semibold">Reference solution</h2>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {LANGUAGES.map((candidate) => (
          <Button
            key={candidate}
            size="sm"
            variant={candidate === shown ? 'secondary' : 'ghost'}
            aria-pressed={candidate === shown}
            onClick={() => {
              setShown(candidate);
            }}
          >
            {LANGUAGE_LABEL[candidate]}
          </Button>
        ))}

        <Button
          size="sm"
          variant="ghost"
          className="ml-auto"
          aria-pressed={comparing}
          onClick={() => {
            setComparing(!comparing);
          }}
        >
          {comparing ? 'Show it whole' : 'Compare with my code'}
        </Button>
      </div>

      {comparing ? (
        shown === language ? (
          <CodeDiff
            className="mt-3"
            before={reference}
            after={code}
            beforeLabel="The reference"
            afterLabel="your code"
          />
        ) : (
          <p className="text-fg-muted mt-3 text-sm">
            You are writing {LANGUAGE_LABEL[language]}, so there is nothing to compare the{' '}
            {LANGUAGE_LABEL[shown]} reference against. Switch the language above, or switch the
            editor.
          </p>
        )
      ) : (
        /*
         * Through the markdown renderer, so the reference is highlighted the
         * same way a fenced block in the editorial above it is. Four backticks:
         * three would end the fence early if the code ever contained a line of
         * them, which Python and Java never will, but the cost of being right
         * about it is one character.
         */
        <Markdown
          className="mt-3"
          content={`\`\`\`\`${shown}
${reference}
\`\`\`\``}
        />
      )}
    </section>
  );
}

function Editorial({
  problem,
  language,
  code,
}: {
  problem: ProblemDetail;
  language: Language;
  code: string;
}) {
  const reveal = useRevealEditorial();
  const [confirming, setConfirming] = useState(false);

  if (!problem.editorialUnlocked || problem.editorial === null) {
    return (
      <div className="p-4">
        <p className="text-fg-muted text-sm">
          The editorial unlocks once you have solved this problem. Until then the hints are the way
          in — they go from a nudge to the full approach.
        </p>

        {/*
          The lock opens from the inside (P7-2). This is the user's own practice
          on their own machine, and a gate they cannot open is one they work
          around by opening the repository - which teaches them nothing and
          tells the progress dashboard nothing either. Opening it is recorded.
        */}
        <Button
          variant="ghost"
          size="sm"
          className="mt-3"
          disabled={reveal.isPending}
          onClick={() => {
            setConfirming(true);
          }}
        >
          Show it anyway
        </Button>

        {reveal.error && (
          <p className="text-danger-fg mt-2 text-sm" role="alert">
            {reveal.error.message}
          </p>
        )}

        <ConfirmDialog
          open={confirming}
          onOpenChange={setConfirming}
          title="Show the editorial before solving it?"
          description="You will see the approach and both reference solutions. This is recorded against the problem and cannot be undone - your progress page will show that this one was opened rather than solved."
          confirmLabel="Show it"
          onConfirm={() => {
            reveal.mutate(problem.summary.slug);
          }}
        />
      </div>
    );
  }

  return (
    <div className="p-4">
      <Markdown content={problem.editorial} assetSlug={problem.summary.slug} />
      {/* Sent together with the editorial, but the two are separate fields and
          the prose is worth showing on its own if ever they are not. */}
      {problem.references !== null && (
        <ReferenceSolution references={problem.references} language={language} code={code} />
      )}
    </div>
  );
}

function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

function SubmissionRow({
  submission,
  selected,
  onSelect,
}: {
  submission: Submission;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    /*
      One button per row, not a link inside one cell: the row is what the eye
      reads as the thing, and a click target smaller than it is a target people
      miss. A disclosure rather than a dialog, so what opens sits beside the
      editor it is about.
    */
    <button
      type="button"
      onClick={onSelect}
      aria-expanded={selected}
      className={cn(
        'focus-ring hover:bg-surface-sunken flex w-full items-center gap-3 px-3 py-1.5 text-left',
        selected && 'bg-surface-sunken',
      )}
    >
      <span className="flex min-w-24 items-center gap-2">
        <span
          aria-hidden
          className={cn('size-1.5 shrink-0 rounded-full', VERDICT_MARK[submission.verdict])}
        />
        <span className={cn('text-xs font-medium', VERDICT_TONE[submission.verdict])}>
          {VERDICT_LABEL[submission.verdict]}
        </span>
      </span>
      <span className="text-fg-muted text-xs">{LANGUAGE_LABEL[submission.language]}</span>
      <span className="text-fg-muted tnum text-xs">
        {submission.passed}/{submission.total}
      </span>
      <span className="text-fg-subtle tnum text-xs" title="Problem version at submit time">
        v{submission.problemVersion}
      </span>
      <span className="text-fg-subtle tnum ml-auto text-xs">{when(submission.createdAt)}</span>
    </button>
  );
}

/**
 * One submission, opened (ROADMAP P7-3).
 *
 * Under the row rather than in a dialog: the point of opening one is to put it
 * next to what is in the editor, and a modal covers the editor.
 */
function OpenSubmission({
  submission,
  code,
  language,
  onRestore,
}: {
  submission: Submission;
  code: string;
  language: Language;
  onRestore: (submission: Submission) => void;
}) {
  const [comparing, setComparing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const differs = submission.language !== language;

  return (
    <div className="border-border border-b px-3 py-3">
      <p className="text-fg-muted text-xs">
        {LANGUAGE_LABEL[submission.language]} · {submission.passed} of {submission.total} tests ·{' '}
        <span className="tnum">{Math.round(submission.timeMs)} ms</span> · problem version{' '}
        <span className="tnum">{submission.problemVersion}</span> · {when(submission.createdAt)}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          aria-pressed={comparing}
          onClick={() => {
            setComparing(!comparing);
          }}
        >
          {comparing ? 'Show it whole' : 'Compare with my code'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            // Only when there is something to lose. Restoring over the untouched
            // starter, or over the very code being restored, is not a decision
            // worth a dialog.
            if (code === submission.code || code.trim() === '') onRestore(submission);
            else setConfirming(true);
          }}
        >
          {differs
            ? `Restore, and switch to ${LANGUAGE_LABEL[submission.language]}`
            : 'Restore into the editor'}
        </Button>
      </div>

      {comparing ? (
        differs ? (
          <p className="text-fg-muted mt-3 text-sm">
            This attempt is in {LANGUAGE_LABEL[submission.language]} and the editor is in{' '}
            {LANGUAGE_LABEL[language]}, so there is nothing line-for-line to compare.
          </p>
        ) : (
          <CodeDiff
            className="mt-3"
            before={submission.code}
            after={code}
            beforeLabel="This attempt"
            afterLabel="what is in the editor"
          />
        )
      ) : (
        <Markdown
          className="mt-3"
          content={`\`\`\`\`${submission.language}
${submission.code}
\`\`\`\``}
        />
      )}

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Replace what is in the editor?"
        description={`The editor will be replaced with this ${LANGUAGE_LABEL[submission.language]} attempt from ${when(submission.createdAt)}. What is there now is autosaved as a draft and will be overwritten.`}
        confirmLabel="Restore"
        onConfirm={() => {
          onRestore(submission);
        }}
      />
    </div>
  );
}

function Submissions({
  slug,
  code,
  language,
  onRestore,
}: {
  slug: string;
  code: string;
  language: Language;
  onRestore: (submission: Submission) => void;
}) {
  const { data, isPending, error } = useSubmissions(slug);
  const [openId, setOpenId] = useState<string | null>(null);

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
    <ul aria-label="Submissions for this problem, newest first" className="text-sm">
      {data.items.map((submission) => (
        <li key={submission.id} className="border-border border-b">
          <SubmissionRow
            submission={submission}
            selected={submission.id === openId}
            onSelect={() => {
              setOpenId(submission.id === openId ? null : submission.id);
            }}
          />
          {submission.id === openId && (
            <OpenSubmission
              submission={submission}
              code={code}
              language={language}
              onRestore={onRestore}
            />
          )}
        </li>
      ))}
    </ul>
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
  /**
   * The editor's language and contents, for the editorial's diff (P7-2).
   *
   * `code` changes on every keystroke, which does cost this memo - but it costs
   * it already: `coach` is rebuilt whenever `askCoach` is, and `askCoach`
   * closes over the code it would send. So this adds a prop, not a re-render.
   */
  language: Language;
  code: string;
  /** Puts an old submission back in the editor (P7-3). */
  onRestore: (submission: Submission) => void;
  coach: ReactNode;
}

function StatementPanelBody({
  problem,
  tab,
  onTab,
  revealedHints,
  onRevealHint,
  language,
  code,
  onRestore,
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
        <Editorial problem={problem} language={language} code={code} />
      </TabsContent>

      <TabsContent value="submissions" className="min-h-0 flex-1 overflow-y-auto pt-0">
        <Submissions slug={summary.slug} code={code} language={language} onRestore={onRestore} />
      </TabsContent>
    </Tabs>
  );
}

/**
 * Memoised (ROADMAP P4-13).

 * Every keystroke in the editor re-renders the workspace, and this subtree is
 * the statement, the hints, the editorial, the submissions list and the coach
 * panel - none of which change while someone types code. Its props are the
 * problem, the selected tab, the revealed-hint count and one element, so a
 * shallow comparison is the right test as long as the caller does not rebuild
 * that element on every render (see `coachPanel` in `Workspace.tsx`).
 */
export const StatementPanel = memo(StatementPanelBody);
