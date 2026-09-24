import { useCallback, useEffect, useRef, useState } from 'react';
import type { Language, RunResult } from '@devpromax/shared';
import type { RunBody } from '../../api/client.js';
import { useJudge, useReVerify } from '../../api/hooks.js';

/**
 * Run, Submit and Re-verify, and the one verdict on screen (ROADMAP P4-15).
 *
 * Out of `Workspace.tsx` because every rule here is about *which* answer is
 * allowed onto the screen, and that was the part of the workspace most often
 * wrong:
 *
 *   - **A verdict belongs to the scope that asked for it** - one problem in one
 *     language. It is compared against the scope showing *now*, read from a ref
 *     at the moment it arrives. The first version compared the request against
 *     the same render's `slug`, which is the request's own slug: the guard could
 *     never fire, and its test passed without ever waiting for the verdict.
 *   - **Only the newest request's error is shown.** Run and Submit are two
 *     mutations, and a failed Run used to sit in front of every later Submit's
 *     result - on this problem and the next one. Both are reset when a request
 *     starts and when the scope changes.
 *   - **Leaving a scope lets go of it.** Resetting the mutations there also
 *     detaches their callbacks, so a run still in flight for the last problem
 *     neither locks this one's language switch nor lands its verdict here. Its
 *     side effects on the cache (status, progress) still happen: those are true
 *     whichever screen is showing.
 */

export type JudgeKind = 'run' | 'submit';

export interface JudgeFlow {
  result: RunResult | null;
  /** The newest request's error, if it failed. */
  failure: Error | null;
  busy: boolean;
  running: boolean;
  submitting: boolean;
  judge: (kind: JudgeKind, body: RunBody) => void;
  reVerify: () => void;
  reVerifying: boolean;
  reVerifyError: Error | null;
}

/**
 * @param onResult - called with each verdict that is allowed onto the screen,
 *   after it has become `result`.
 */
export function useJudgeFlow(
  slug: string,
  language: Language,
  onResult: (result: RunResult, kind: JudgeKind | 'reverify') => void,
): JudgeFlow {
  const run = useJudge('run');
  const submit = useJudge('submit');
  const verify = useReVerify();
  const scope = `${slug}:${language}`;

  const [result, setResult] = useState<RunResult | null>(null);
  // Reset during render, like the editor's own reset: an effect would paint the
  // last problem's verdict over this one's for a frame.
  const [scoped, setScoped] = useState(scope);
  if (scoped !== scope) {
    setScoped(scope);
    setResult(null);
  }

  /** Which scope is on screen *now*, for answers that arrive later. */
  const showing = useRef(scope);
  const latestResult = useRef(onResult);
  useEffect(() => {
    showing.current = scope;
    latestResult.current = onResult;
  });

  const { mutate: runMutate, reset: runReset } = run;
  const { mutate: submitMutate, reset: submitReset } = submit;
  const { mutate: verifyMutate, reset: verifyReset } = verify;

  useEffect(() => {
    runReset();
    submitReset();
    verifyReset();
  }, [scope, runReset, submitReset, verifyReset]);

  const land = useCallback((next: RunResult, asked: string, kind: JudgeKind | 'reverify') => {
    if (asked !== showing.current) return;
    setResult(next);
    latestResult.current(next, kind);
  }, []);

  const judge = useCallback(
    (kind: JudgeKind, body: RunBody) => {
      runReset();
      submitReset();
      const asked = `${body.slug}:${body.language}`;
      (kind === 'run' ? runMutate : submitMutate)(body, {
        onSuccess: (next) => {
          land(next, asked, kind);
        },
      });
    },
    [runMutate, submitMutate, runReset, submitReset, land],
  );

  const reVerify = useCallback(() => {
    runReset();
    submitReset();
    const asked = `${slug}:${language}`;
    verifyMutate(
      { slug, language },
      {
        onSuccess: (next) => {
          land(next, asked, 'reverify');
        },
      },
    );
  }, [slug, language, verifyMutate, runReset, submitReset, land]);

  return {
    result,
    failure: run.error ?? submit.error,
    busy: run.isPending || submit.isPending,
    running: run.isPending,
    submitting: submit.isPending,
    judge,
    reVerify,
    reVerifying: verify.isPending,
    reVerifyError: verify.error,
  };
}
