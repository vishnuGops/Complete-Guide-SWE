import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';
import type { ProblemDetail, ProblemListResponse, RunResult } from '@devpromax/shared';
import { api, type RunBody } from './client.js';

/**
 * Server state (ROADMAP P4-1, D-stack TanStack Query).
 *
 * Query keys are the shape the invalidation needs: `['problems']` for the list
 * and `['problem', slug]` for one. An accepted submit has to flip the row in the
 * list to Solved without a reload (P4-8), and that is one `invalidateQueries`
 * away only because the keys are separate.
 */

export const keys = {
  problems: ['problems'] as const,
  problem: (slug: string) => ['problem', slug] as const,
};

export function useProblems() {
  return useQuery<ProblemListResponse>({ queryKey: keys.problems, queryFn: api.problems });
}

export function useProblem(slug: string) {
  return useQuery<ProblemDetail>({
    queryKey: keys.problem(slug),
    queryFn: () => api.problem(slug),
  });
}

/**
 * Run and Submit.
 *
 * Both invalidate progress, because both move a problem's status: Run marks it
 * In progress and an accepted Submit marks it Solved (D11). The judge decides
 * what happened; the UI's job is to stop showing a stale answer.
 */
export function useJudge(kind: 'run' | 'submit'): UseMutationResult<RunResult, Error, RunBody> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: kind === 'run' ? api.run : api.submit,
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: keys.problems });
      void queryClient.invalidateQueries({ queryKey: keys.problem(variables.slug) });
    },
  });
}
