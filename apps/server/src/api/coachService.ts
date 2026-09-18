import {
  COACH_SKIP_MESSAGE,
  applyProgressEvent,
  costUsd,
  initialProgress,
  meetsMastery,
  priceFor,
  statusRank,
  type CoachChatRequest,
  type CoachFeedback,
  type CoachFeedbackRequest,
  type CoachStreamEvent,
  type Language,
  type TokenUsage,
} from '@devpromax/shared';
import {
  buildContext,
  CoachProviderError,
  createCoachProvider,
  describeDelta,
  diffCode,
  precheck,
  streamCoachFeedback,
  systemPrompt,
  type AttemptMemory,
  type CoachTurn,
  type ProviderOptions,
} from '../coach/index.js';
import type { Repositories } from '../db/index.js';
import type { Catalogue } from './catalogue.js';
import { notFound } from './errors.js';
import { resolveApiKey } from './settingsService.js';

/**
 * The coaching turn, end to end (ROADMAP P5-3, D13).
 *
 * This is where the on-demand rule is actually enforced. Nothing here is
 * reachable from Run or Submit; the only way in is the AI Help button, and the
 * first thing that happens is a local check that can refuse without spending
 * anything.
 *
 * Both entry points are async generators of `CoachStreamEvent`, so the route
 * layer's only job is to write frames. That split matters for testing: every
 * decision below - refuse, persist, map an error - is exercised without an HTTP
 * server, and the route tests only have to prove the frames come out.
 */

export interface CoachServiceDeps {
  repos: Repositories;
  catalogue: Catalogue;
  env?: NodeJS.ProcessEnv;
  provider?: ProviderOptions;
}

/** How many earlier coaching turns to carry into the prompt (P5-5). */
const MEMORY_DEPTH = 3;

function skip(reason: keyof typeof COACH_SKIP_MESSAGE): CoachStreamEvent {
  return { type: 'skipped', reason, message: COACH_SKIP_MESSAGE[reason] };
}

/**
 * Turns anything thrown during a turn into an error frame.
 *
 * A `CoachProviderError` already carries wording meant for a person. Anything
 * else is a bug on our side, and saying so plainly beats forwarding an
 * exception message the user cannot act on.
 */
function toErrorEvent(error: unknown): CoachStreamEvent {
  if (error instanceof CoachProviderError) {
    return { type: 'error', message: error.message, retryable: error.retryable };
  }
  return {
    type: 'error',
    message: 'Something went wrong while asking the coach.',
    retryable: true,
  };
}

/**
 * Earlier feedback on this problem, newest first, for the prompt's memory
 * section (ROADMAP P5-5).
 *
 * Each remembered turn carries a diff against the code in front of the coach
 * now, which is what lets it say "you fixed X, now Y" rather than reviewing
 * from scratch. Each diff is bounded, so three remembered turns cannot crowd
 * out the code they are about.
 */
function recallAttempts(
  repos: Repositories,
  slug: string,
  language: Language,
  currentCode: string,
): AttemptMemory[] {
  return repos.coach.recentFeedback(slug, language, MEMORY_DEPTH).flatMap((message) => {
    if (!message.feedback) return [];
    return [
      {
        at: message.createdAt,
        feedback: message.feedback,
        // Absent on turns recorded before P5-5's column existed. The memory is
        // still worth having without it, so that is a missing detail rather
        // than a reason to drop the attempt.
        ...(message.code === null
          ? {}
          : { delta: describeDelta(diffCode(message.code, currentCode)) }),
      },
    ];
  });
}

/**
 * Whether this conversation has already spent its allowance (ROADMAP P5-6).
 *
 * The cap is per conversation, which is the reading the schema supports -
 * `coach_sessions` is the only thing in this codebase called a session - and it
 * is the unit a runaway actually happens in: someone going round and round on
 * one problem. It does not bound a whole evening across twenty problems, and
 * `docs/COACH_PROMPTS.md` says so rather than letting the name imply otherwise.
 *
 * Checked *before* a turn, against what has already been spent, because the
 * cost of the turn about to be made is not knowable until it is made. So the cap
 * is a floor the next turn may cross, not a ceiling it cannot: with a $1 cap the
 * bill stops somewhere in the first dollar-and-a-bit, never at twenty.
 */
function overSpendCap(sessionId: string, capUsd: number | null, deps: CoachServiceDeps): boolean {
  if (capUsd === null) return false;
  return deps.repos.coach.sessionSpendUsd(sessionId) >= capUsd;
}

/**
 * A structured review of the code currently in the editor.
 *
 * The order of the guards is the order of what they cost. The pre-check is free
 * and runs first; the key lookup is a database read; only then is a request
 * made. Reversing any of that would mean paying to discover something we
 * already knew.
 */
export async function* streamFeedback(
  request: CoachFeedbackRequest,
  deps: CoachServiceDeps,
): AsyncGenerator<CoachStreamEvent> {
  const pkg = deps.catalogue.get(request.slug);
  if (!pkg) throw notFound(`No problem with slug "${request.slug}".`);

  const starter =
    request.language === 'python' ? pkg.sources.starterPython : pkg.sources.starterJava;

  const refusal = precheck({ code: request.code, starter, language: request.language });
  if (refusal) {
    yield skip(refusal);
    return;
  }

  const settings = deps.repos.settings.get();
  const resolved = resolveApiKey(deps.repos, deps.env);
  if (resolved.key === null) {
    yield skip('no_api_key');
    return;
  }

  // The conversation is found before the cap is checked, because the cap is a
  // property of the conversation: a fresh one starts from zero.
  const existing = deps.repos.coach.latestSession(request.slug, request.language);
  if (existing && overSpendCap(existing.id, settings.coach.spendCapUsd, deps)) {
    yield skip('spend_cap_reached');
    return;
  }

  // Solved in any language, matching how the editorial unlocks: the approach is
  // the same approach, and the coach's solution gate is about the same secret.
  const solved = deps.repos.progress
    .listByProblem(request.slug)
    .some((row) => statusRank(row.status) >= statusRank('solved'));

  const context = buildContext({
    meta: pkg.meta,
    statement: pkg.statement,
    editorial: pkg.editorial,
    language: request.language,
    code: request.code,
    revealedHints: pkg.hints.hints.slice(0, request.revealedHints),
    priorAttempts: recallAttempts(deps.repos, request.slug, request.language, request.code),
    masteryCheck: request.masteryCheck,
    requestFullSolution: request.requestFullSolution,
    solved,
  });

  // The conversation is created before the request, so the panel can address it
  // in a follow-up even if this turn fails partway through.
  const session = existing ?? deps.repos.coach.createSession(request.slug, request.language);
  yield { type: 'start', sessionId: session.id };

  deps.repos.coach.addMessage(session.id, { role: 'user', content: context });

  const provider = createCoachProvider(settings.coach.provider, deps.provider ?? {});

  let spent: number | null = null;

  try {
    for await (const chunk of streamCoachFeedback(provider, {
      apiKey: resolved.key,
      model: settings.coach.model,
      system: systemPrompt(),
      messages: [{ role: 'user', content: context }],
      onUsage: (usage: TokenUsage) => {
        spent = costUsd(usage, priceFor(settings.coach.provider, settings.coach.model));
      },
    })) {
      if (chunk.type === 'markdown') {
        yield { type: 'markdown', delta: chunk.delta };
        continue;
      }

      // Persisted before it is announced: a `done` the client acted on but the
      // database never saw would leave a rubric card that vanishes on reload.
      deps.repos.coach.addMessage(session.id, {
        role: 'coach',
        content: chunk.feedback.feedbackMarkdown,
        feedback: chunk.feedback,
        // The code this feedback is about, so the next turn can diff against it.
        code: request.code,
        // Null when the vendor reported nothing; the cap reads that as unknown,
        // not as free (P5-6).
        ...(spent === null ? {} : { costUsd: spent }),
      });
      applyMastery(chunk.feedback, request, deps);
      yield { type: 'done', feedback: chunk.feedback };
    }
  } catch (error) {
    yield toErrorEvent(error);
  }
}

/**
 * Records the coach's verdict against the progress engine (ROADMAP P5-4, D11).
 *
 * Three gates, and all three have to hold, which is why this is a function
 * rather than a line:
 *
 *   1. **The coach says so.** `mastered` comes back in the structured answer.
 *   2. **The scores agree with it.** `meetsMastery` re-checks every dimension
 *      against the threshold, so a model that sets the flag while scoring a 2
 *      somewhere does not get to promote. The flag is a claim; the scores are
 *      the evidence, and disagreement resolves against the claim.
 *   3. **The judge has agreed the code is correct.** `applyProgressEvent`
 *      refuses `coach_mastered` below Solved on its own, so this cannot promote
 *      code that has never passed - a rubric about code the judge has not
 *      accepted is a judgement about something unproven.
 *
 * A failed check writes `coach_not_mastered`, which deliberately changes
 * nothing. It is the coach declining to promote, not grounds to take away a
 * status the user has already earned.
 */
function applyMastery(
  feedback: CoachFeedback,
  request: CoachFeedbackRequest,
  deps: CoachServiceDeps,
): void {
  const claimed = feedback.mastered && meetsMastery(feedback.scores);

  const current =
    deps.repos.progress.get(request.slug, request.language) ??
    initialProgress(request.slug, request.language);

  deps.repos.progress.put(
    applyProgressEvent(current, {
      event: claimed ? 'coach_mastered' : 'coach_not_mastered',
    }),
  );
}

/**
 * A follow-up question in an existing conversation.
 *
 * No pre-check and no rubric: the user has already been given feedback and is
 * asking about it, so there is nothing to refuse and nothing new to score. The
 * reply is plain prose, which is why this does not go through
 * `streamCoachFeedback` - there is no structured document to assemble.
 */
export async function* streamChat(
  request: CoachChatRequest,
  deps: CoachServiceDeps,
): AsyncGenerator<CoachStreamEvent> {
  const session = deps.repos.coach.getSession(request.sessionId);
  if (!session) throw notFound('That coaching conversation no longer exists.');

  const settings = deps.repos.settings.get();
  const resolved = resolveApiKey(deps.repos, deps.env);
  if (resolved.key === null) {
    yield skip('no_api_key');
    return;
  }

  const history: CoachTurn[] = deps.repos.coach
    .listMessages(session.id)
    .map((message) => ({ role: message.role, content: message.content }));

  deps.repos.coach.addMessage(session.id, { role: 'user', content: request.message });
  yield { type: 'start', sessionId: session.id };

  const provider = createCoachProvider(settings.coach.provider, deps.provider ?? {});

  let reply = '';
  try {
    for await (const chunk of provider.stream({
      apiKey: resolved.key,
      model: settings.coach.model,
      system: systemPrompt(),
      // No schema: prose, not a document. The schema that makes a review
      // parseable would make a one-sentence answer arrive quoted and escaped,
      // and the panel would render the escapes.
      messages: [...history, { role: 'user', content: request.message }],
    })) {
      reply += chunk;
      yield { type: 'markdown', delta: chunk };
    }
  } catch (error) {
    yield toErrorEvent(error);
    return;
  }

  deps.repos.coach.addMessage(session.id, { role: 'coach', content: reply });
  yield { type: 'reply', content: reply };
}
