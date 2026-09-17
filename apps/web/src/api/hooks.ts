import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';
import type {
  DraftResponse,
  Language,
  ProblemDetail,
  ProblemListQuery,
  ProblemListResponse,
  ProgressResponse,
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

export function useSettings() {
  return useQuery<SettingsView>({ queryKey: keys.settings, queryFn: api.settings });
}

export function useUpdateSettings(): UseMutationResult<SettingsView, Error, SettingsUpdate> {
  const queryClient = useQueryClient();
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
    },
    // The server merges the patch and answers with the whole view, so there is
    // nothing to refetch - writing the answer into the cache is the update.
    onSuccess: (view) => {
      queryClient.setQueryData(keys.settings, view);
    },
  });
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
 * Autosaving the editor.
 *
 * Deliberately invalidates nothing. A draft changes no status and no counts
 * (D11), and refetching the problem after every keystroke's worth of debounce
 * would replace the code the user is typing with the code they had a second ago.
 */
export function useSaveDraft(): UseMutationResult<
  DraftResponse,
  Error,
  { slug: string; language: Language; code: string }
> {
  return useMutation({
    mutationFn: ({ slug, language, code }) => api.saveDraft(slug, language, code),
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
    onSuccess: (_result, { slug }) => {
      void queryClient.invalidateQueries({ queryKey: keys.problem(slug) });
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
      if (kind === 'submit') {
        void queryClient.invalidateQueries({ queryKey: keys.submissions(variables.slug) });
      }
    },
  });
}
