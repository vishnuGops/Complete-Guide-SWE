import { useRef } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';
import type {
  ConnectionTestResponse,
  DashboardResponse,
  DraftResponse,
  HintRevealResponse,
  Language,
  NoteResponse,
  ProblemDetail,
  ProblemListQuery,
  ProblemListResponse,
  ProgressResponse,
  ReportFormat,
  ResetProgressResponse,
  RunResult,
  SettingsUpdate,
  SettingsView,
  SubmissionListResponse,
} from '@devpromax/shared';
import { api, problemQueryString, type RunBody } from './client.js';

/**
 * Server state (ROADMAP P4-1, P4-2, D-stack TanStack Query).
 *
 * Query keys are the shape the invalidation needs: `['problems', <query>]` for
 * the list and `['problem', slug]` for one. An accepted submit has to flip the
 * row in the list to Solved without a reload (P4-8), and that is one
 * `invalidateQueries` away only because the keys are separate.
 *
 * The list key carries the serialised query rather than the object: two filter
 * objects that produce the same URL are the same request, and a key built from
 * an object literal would miss the cache every render.
 */

export const keys = {
  problems: ['problems'] as const,
  problemList: (query: Partial<ProblemListQuery>) =>
    ['problems', problemQueryString(query)] as const,
  problem: (slug: string) => ['problem', slug] as const,
  submissions: (slug: string) => ['submissions', slug] as const,
  progress: ['progress'] as const,
  dashboard: ['dashboard'] as const,
  settings: ['settings'] as const,
};

export function useProblems(query: Partial<ProblemListQuery> = {}) {
  return useQuery<ProblemListResponse>({
    queryKey: keys.problemList(query),
    queryFn: () => api.problems(query),
    // Filtering should not blank the table while the next page loads: the
    // previous rows stay, greyed by the caller, until the new ones arrive.
    placeholderData: (previous) => previous,
  });
}

export function useProblem(slug: string) {
  return useQuery<ProblemDetail>({
    queryKey: keys.problem(slug),
    queryFn: () => api.problem(slug),
  });
}

export function useSubmissions(slug: string, enabled = true) {
  return useQuery<SubmissionListResponse>({
    queryKey: keys.submissions(slug),
    queryFn: () => api.submissions(slug),
    enabled,
  });
}

/** The catalogue-wide counts. Unfiltered by construction, so the top bar can use it. */
export function useProgress() {
  return useQuery<ProgressResponse>({ queryKey: keys.progress, queryFn: api.progress });
}

/**
 * The dashboard (ROADMAP P7-5).
 *
 * Its own key rather than an extension of `['progress']`: the top bar reads the
 * cheap counts on every screen, and this one walks the event log and every
 * stored coach score. They are refetched by different things.
 */
export function useDashboard() {
  return useQuery<DashboardResponse>({ queryKey: keys.dashboard, queryFn: api.dashboard });
}

/** Downloading the skills report. A mutation: it is a button, not a fact. */
export function useDownloadReport(): UseMutationResult<void, Error, ReportFormat> {
  return useMutation({ mutationFn: api.downloadReport });
}

export function useSettings() {
  return useQuery<SettingsView>({ queryKey: keys.settings, queryFn: api.settings });
}

export function useUpdateSettings(): UseMutationResult<SettingsView, Error, SettingsUpdate> {
  const queryClient = useQueryClient();
  /**
   * Which write is the latest (ROADMAP P4-13).
   *
   * Two settings writes in quick succession - a theme click followed by
   * another, or a font size and a tab size - can resolve out of order, and the
   * older answer then repaints the older value. A counter is enough: each
   * mutation takes a ticket, and an answer whose ticket is not the newest is
   * dropped rather than written into the cache.
   */
  const latest = useRef(0);

  return useMutation({
    mutationFn: api.updateSettings,
    /**
     * Any settings read still in flight is abandoned first.
     *
     * Without this, a page whose first settings fetch has not landed yet and
     * whose user has already clicked a theme gets the answer to the *older*
     * question written over the newer one, and the theme bounces back a moment
     * after being chosen. Rare by hand, reliable enough under a test runner
     * that it was found by one (P4-10).
     */
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: keys.settings });
      latest.current += 1;
      return { ticket: latest.current };
    },
    // The server merges the patch and answers with the whole view, so there is
    // nothing to refetch - writing the answer into the cache is the update.
    onSuccess: (view, _patch, context) => {
      // An answer to a question a later write has already superseded is not an
      // update; it is the older value arriving second (P4-13).
      if (context?.ticket !== latest.current) return;
      queryClient.setQueryData(keys.settings, view);
    },
  });
}

/**
 * "Test connection" (ROADMAP P5-8).
 *
 * A mutation, not a query: it is a button, it costs a round trip to the vendor,
 * and a query would re-run it on every remount of the Settings screen. Nothing
 * is invalidated - the answer is about the key, and the key did not change.
 */
export function useTestConnection(): UseMutationResult<ConnectionTestResponse, Error, void> {
  return useMutation({ mutationFn: api.testConnection });
}

/**
 * Wiping every trace of practice (ROADMAP P3-4).
 *
 * Clears the whole cache rather than naming queries: this deletes submissions,
 * progress, drafts, events and coach sessions at once, and a list of query keys
 * here would be a second copy of that list, kept in step by hope.
 */
export function useResetProgress(): UseMutationResult<ResetProgressResponse, Error, void> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.resetProgress,
    onSuccess: () => {
      void queryClient.invalidateQueries();
    },
  });
}

/**
 * Writes a draft the server has confirmed into the cached problem.
 *
 * The bug this exists for (ROADMAP P4-11): the workspace seeds the editor from
 * `problem.drafts[language]`, and the cached problem was whatever the page
 * loaded with. So Java, then Python, then back to Java restored the *starter*
 * over ten minutes of typing - and the next autosave wrote that starter over
 * the real draft on disk. The save was working perfectly; the cache had never
 * been told.
 *
 * A write-through rather than an invalidation, deliberately. D11 says a draft
 * moves nothing, and refetching the problem after every keystroke's worth of
 * debounce would replace the code being typed with the code from a second ago.
 */
function writeDraftThrough(
  queryClient: QueryClient,
  slug: string,
  language: Language,
  draft: DraftResponse['draft'],
): void {
  queryClient.setQueryData<ProblemDetail>(keys.problem(slug), (previous) => {
    if (!previous) return previous;
    const drafts = { ...previous.drafts };
    if (draft === null) delete drafts[language];
    else drafts[language] = draft;
    return { ...previous, drafts };
  });
}

/** Autosaving the editor. Invalidates nothing; see `writeDraftThrough`. */
export function useSaveDraft(): UseMutationResult<
  DraftResponse,
  Error,
  { slug: string; language: Language; code: string }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, language, code }) => api.saveDraft(slug, language, code),
    onSuccess: (result, { slug, language }) => {
      writeDraftThrough(queryClient, slug, language, result.draft);
    },
  });
}

export function useDeleteDraft(): UseMutationResult<
  DraftResponse,
  Error,
  { slug: string; language: Language }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, language }) => api.deleteDraft(slug, language),
    // Reset-to-starter removes one language's draft and nothing else, so the
    // same write-through applies: an invalidation here would refetch the whole
    // problem to learn one thing the response already said.
    onSuccess: (_result, { slug, language }) => {
      writeDraftThrough(queryClient, slug, language, null);
    },
  });
}

/**
 * Revealing a hint (ROADMAP P7-1).
 *
 * Write-through for the same reason drafts are: the answer already says what the
 * count became, and refetching the problem to learn it would replace the whole
 * detail payload - editorial lock, drafts and all - to update one integer.
 *
 * The button has already moved when this runs, so the write-through is what
 * makes a reload agree with the screen rather than what paints it. A failure
 * leaves the cache alone: the hint stays visible for this sitting, because
 * re-hiding text the user has read is worse than a count that is behind.
 */
export function useRevealHint(): UseMutationResult<
  HintRevealResponse,
  Error,
  { slug: string; revealed: number }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, revealed }) => api.revealHint(slug, revealed),
    onSuccess: (result, { slug }) => {
      queryClient.setQueryData<ProblemDetail>(keys.problem(slug), (previous) =>
        previous ? { ...previous, revealedHints: result.revealed } : previous,
      );
    },
  });
}

/**
 * Autosaving a note (ROADMAP P7-4).
 *
 * Write-through rather than an invalidation, like a draft: the answer already
 * says what the note became, and refetching the problem after every debounce
 * would replace the payload the user is looking at to learn one string.
 *
 * `['problems']` is invalidated too, but only when the note appears or
 * disappears - the list shows a marker on problems that have one, and the
 * search looks inside them. Every keystroke would be a list refetch for nothing.
 */
export function useSaveNote(): UseMutationResult<
  NoteResponse,
  Error,
  { slug: string; body: string }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, body }) => api.saveNote(slug, body),
    onSuccess: (result, { slug }) => {
      let appeared = false;
      queryClient.setQueryData<ProblemDetail>(keys.problem(slug), (previous) => {
        if (!previous) return previous;
        appeared = (previous.note === null) !== (result.note === null);
        return {
          ...previous,
          note: result.note?.body ?? null,
          summary: { ...previous.summary, hasNote: result.note !== null },
        };
      });
      if (appeared) void queryClient.invalidateQueries({ queryKey: keys.problems });
    },
  });
}

/**
 * "Show me the editorial anyway" (ROADMAP P7-2).
 *
 * The answer is the whole problem detail, unlocked - the editorial and the two
 * reference solutions were not in the payload a moment ago, and now they are -
 * so it is written straight into the cache. Progress is invalidated too,
 * because the reveal is recorded as activity and the dashboard counts it.
 */
export function useRevealEditorial(): UseMutationResult<ProblemDetail, Error, string> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.revealEditorial,
    onSuccess: (detail, slug) => {
      queryClient.setQueryData(keys.problem(slug), detail);
      void queryClient.invalidateQueries({ queryKey: keys.progress });
      // The dashboard counts the same things plus the activity behind them.
      void queryClient.invalidateQueries({ queryKey: keys.dashboard });
    },
  });
}

/**
 * Run and Submit.
 *
 * Both invalidate progress, because both move a problem's status: Run marks it
 * In progress and an accepted Submit marks it Solved (D11). The judge decides
 * what happened; the UI's job is to stop showing a stale answer.
 *
 * `['problems']` is a prefix of every list key, so one call covers whatever
 * filter the list happens to be showing (P4-8).
 */
export function useJudge(kind: 'run' | 'submit'): UseMutationResult<RunResult, Error, RunBody> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: kind === 'run' ? api.run : api.submit,
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: keys.problems });
      void queryClient.invalidateQueries({ queryKey: keys.problem(variables.slug) });
      void queryClient.invalidateQueries({ queryKey: keys.progress });
      // The dashboard counts the same things plus the activity behind them.
      void queryClient.invalidateQueries({ queryKey: keys.dashboard });
      if (kind === 'submit') {
        void queryClient.invalidateQueries({ queryKey: keys.submissions(variables.slug) });
      }
    },
  });
}
