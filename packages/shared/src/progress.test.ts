import { describe, it, expect } from 'vitest';
import {
  PROGRESS_EVENTS,
  PROGRESS_STATUSES,
  applyProgressEvent,
  bestStatus,
  initialProgress,
  problemProgressSchema,
  problemStatus,
  statusRank,
  submissionSchema,
  type ProblemProgress,
  type ProgressEvent,
  type ProgressStatus,
} from './progress.js';

describe('status ordering', () => {
  it('ranks the four states weakest to strongest', () => {
    expect(PROGRESS_STATUSES).toEqual(['not_started', 'in_progress', 'solved', 'mastered']);
    expect(statusRank('not_started')).toBeLessThan(statusRank('in_progress'));
    expect(statusRank('in_progress')).toBeLessThan(statusRank('solved'));
    expect(statusRank('solved')).toBeLessThan(statusRank('mastered'));
  });
});

describe('bestStatus', () => {
  it('rolls up across languages by taking the strongest', () => {
    expect(bestStatus(['in_progress', 'solved'])).toBe('solved');
    expect(bestStatus(['mastered', 'not_started'])).toBe('mastered');
  });

  it('returns not_started for an empty roll-up', () => {
    expect(bestStatus([])).toBe('not_started');
  });

  it('is order-independent', () => {
    expect(bestStatus(['solved', 'in_progress'])).toBe(bestStatus(['in_progress', 'solved']));
  });
});

describe('problemProgressSchema', () => {
  it('defaults timestamps to null and attempts to zero', () => {
    const parsed = problemProgressSchema.parse({
      slug: 'two-sum',
      language: 'python',
      status: 'in_progress',
    });
    expect(parsed.attempts).toBe(0);
    expect(parsed.solvedAt).toBeNull();
    expect(parsed.masteredAt).toBeNull();
    expect(parsed.lastAttemptedAt).toBeNull();
  });

  it('rejects a non-ISO timestamp', () => {
    expect(
      problemProgressSchema.safeParse({
        slug: 'two-sum',
        language: 'python',
        status: 'solved',
        solvedAt: '16/09/2026',
      }).success,
    ).toBe(false);
  });
});

describe('submissionSchema', () => {
  const base = {
    id: '4b1e2c5a-0f0c-4a3d-9c2a-4a5b6c7d8e9f',
    slug: 'two-sum',
    language: 'python',
    code: 'class Solution: pass',
    verdict: 'WA',
    passed: 3,
    total: 13,
    timeMs: 42,
    problemVersion: 2,
    createdAt: '2026-09-16T10:00:00.000Z',
  };

  it('accepts a complete submission', () => {
    expect(submissionSchema.parse(base).problemVersion).toBe(2);
  });

  it('requires a uuid id', () => {
    expect(submissionSchema.safeParse({ ...base, id: 'sub-1' }).success).toBe(false);
  });

  it('records the problem version so a later test change cannot rewrite history', () => {
    const { problemVersion: _omitted, ...withoutVersion } = base;
    expect(submissionSchema.safeParse(withoutVersion).success).toBe(false);
  });
});

const AT = '2026-09-17T09:00:00.000Z';
const LATER = '2026-09-18T09:00:00.000Z';

/** A row in an arbitrary state, for the exhaustive sweeps below. */
function at(status: ProgressStatus, over: Partial<ProblemProgress> = {}): ProblemProgress {
  return {
    ...initialProgress('pair-sum-index', 'python'),
    status,
    solvedAt: statusIsAtLeast(status, 'solved') ? AT : null,
    masteredAt: statusIsAtLeast(status, 'mastered') ? AT : null,
    ...over,
  };
}

function statusIsAtLeast(status: ProgressStatus, floor: ProgressStatus): boolean {
  return PROGRESS_STATUSES.indexOf(status) >= PROGRESS_STATUSES.indexOf(floor);
}

const apply = (
  current: ProblemProgress,
  event: ProgressEvent,
  extra: { status?: ProgressStatus; at?: string } = {},
): ProblemProgress => applyProgressEvent(current, { event, at: LATER, ...extra });

describe('initialProgress', () => {
  it('starts a problem not started, with nothing recorded', () => {
    const progress = initialProgress('pair-sum-index', 'java');
    expect(progress).toEqual({
      slug: 'pair-sum-index',
      language: 'java',
      status: 'not_started',
      attempts: 0,
      solvedAt: null,
      masteredAt: null,
      lastAttemptedAt: null,
    });
  });

  it('produces a row the schema accepts', () => {
    expect(
      problemProgressSchema.safeParse(initialProgress('pair-sum-index', 'python')).success,
    ).toBe(true);
  });
});

describe('run', () => {
  it('moves a fresh problem to in progress (D11: first Run or Submit)', () => {
    const next = apply(initialProgress('pair-sum-index', 'python'), 'run');
    expect(next.status).toBe('in_progress');
    expect(next.lastAttemptedAt).toBe(LATER);
  });

  it('does not count as an attempt', () => {
    // Attempts are submissions; running is practice.
    expect(apply(at('in_progress', { attempts: 2 }), 'run').attempts).toBe(2);
  });

  it('records the attempt time without changing a stronger status', () => {
    const next = apply(at('mastered'), 'run');
    expect(next.status).toBe('mastered');
    expect(next.lastAttemptedAt).toBe(LATER);
    expect(next.masteredAt).toBe(AT);
  });
});

describe('submit_accepted', () => {
  it('solves a problem that was never started', () => {
    const next = apply(initialProgress('pair-sum-index', 'python'), 'submit_accepted');
    expect(next.status).toBe('solved');
    expect(next.solvedAt).toBe(LATER);
    expect(next.attempts).toBe(1);
    expect(next.lastAttemptedAt).toBe(LATER);
  });

  it('keeps the first solve time on a later accepted submission', () => {
    // solvedAt answers "when did you get this", which solving it again does not change.
    const next = apply(at('solved'), 'submit_accepted');
    expect(next.solvedAt).toBe(AT);
    expect(next.attempts).toBe(1);
  });

  it('leaves a mastered problem mastered', () => {
    const next = apply(at('mastered'), 'submit_accepted');
    expect(next.status).toBe('mastered');
    expect(next.masteredAt).toBe(AT);
  });
});

describe('submit_rejected', () => {
  it('moves a fresh problem to in progress and counts the attempt', () => {
    const next = apply(initialProgress('pair-sum-index', 'python'), 'submit_rejected');
    expect(next.status).toBe('in_progress');
    expect(next.attempts).toBe(1);
  });

  // The regression the roadmap calls out by name.
  it('never demotes a solved problem', () => {
    const next = apply(at('solved', { attempts: 3 }), 'submit_rejected');
    expect(next.status).toBe('solved');
    expect(next.solvedAt).toBe(AT);
    expect(next.attempts).toBe(4);
  });

  it('never demotes a mastered problem', () => {
    expect(apply(at('mastered'), 'submit_rejected').status).toBe('mastered');
  });
});

describe('coach_mastered', () => {
  it('promotes a solved problem and records when', () => {
    const next = apply(at('solved'), 'coach_mastered');
    expect(next.status).toBe('mastered');
    expect(next.masteredAt).toBe(LATER);
  });

  it('is ignored below solved: mastery needs the judge to agree first (D11)', () => {
    for (const status of ['not_started', 'in_progress'] as const) {
      const before = at(status);
      expect(apply(before, 'coach_mastered')).toEqual(before);
    }
  });

  it('keeps the first mastery time', () => {
    expect(apply(at('mastered'), 'coach_mastered').masteredAt).toBe(AT);
  });

  it('is not an attempt', () => {
    expect(apply(at('solved', { attempts: 2 }), 'coach_mastered').attempts).toBe(2);
  });
});

describe('coach_not_mastered', () => {
  it('changes nothing at all, whatever the current status', () => {
    for (const status of PROGRESS_STATUSES) {
      const before = at(status, { attempts: 2, lastAttemptedAt: AT });
      expect(apply(before, 'coach_not_mastered')).toEqual(before);
    }
  });
});

describe('manual_override', () => {
  it('is the one event that may move a status down', () => {
    const next = apply(at('mastered'), 'manual_override', { status: 'in_progress' });
    expect(next.status).toBe('in_progress');
    expect(next.solvedAt).toBeNull();
    expect(next.masteredAt).toBeNull();
  });

  it('clears only the timestamps the new status no longer justifies', () => {
    const next = apply(at('mastered'), 'manual_override', { status: 'solved' });
    expect(next.solvedAt).toBe(AT);
    expect(next.masteredAt).toBeNull();
  });

  it('reaches Solved at most, because Mastered is the coach’s to give (D25)', () => {
    // "I solved this on paper" is a claim the user is entitled to make. "The
    // coach passed this" is not - and an override to Mastered unlocked the
    // editorial and the `solution` rung with no submission behind it, which is
    // the one thing D13 exists to prevent (P5-10).
    const next = apply(initialProgress('pair-sum-index', 'python'), 'manual_override', {
      status: 'mastered',
    });

    // Clamped rather than refused: the highest status that is theirs to claim
    // is granted, which is a better answer than rejecting the whole request.
    expect(next.status).toBe('solved');
    expect(next.solvedAt).toBe(LATER);
    expect(next.masteredAt).toBeNull();
  });

  it('cannot re-grant a mastery it once had', () => {
    // The row was Mastered, the user dropped it to In progress, and now claims
    // Mastered again: still Solved at most, and the coach's old timestamp does
    // not come back with it.
    const dropped = apply(at('mastered'), 'manual_override', { status: 'in_progress' });
    const next = applyProgressEvent(dropped, {
      event: 'manual_override',
      status: 'mastered',
      at: LATER,
    });

    expect(next.status).toBe('solved');
    expect(next.masteredAt).toBeNull();
  });

  it('keeps the attempt count, which records what actually happened', () => {
    const next = apply(at('solved', { attempts: 5 }), 'manual_override', { status: 'not_started' });
    expect(next.attempts).toBe(5);
    expect(next.lastAttemptedAt).toBe(at('solved').lastAttemptedAt);
  });

  it('refuses an override with no target status', () => {
    expect(() => applyProgressEvent(at('solved'), { event: 'manual_override' })).toThrow(
      /requires the status/,
    );
  });
});

describe('engine invariants', () => {
  it('never mutates the row it was given', () => {
    for (const event of PROGRESS_EVENTS) {
      const before = at('solved', { attempts: 1, lastAttemptedAt: AT });
      const snapshot = structuredClone(before);
      apply(before, event, { status: 'not_started' });
      expect(before).toEqual(snapshot);
    }
  });

  it('only manual_override can lower a status, from any state', () => {
    for (const status of PROGRESS_STATUSES) {
      for (const event of PROGRESS_EVENTS) {
        if (event === 'manual_override') continue;
        const before = at(status);
        const after = apply(before, event);
        expect(PROGRESS_STATUSES.indexOf(after.status)).toBeGreaterThanOrEqual(
          PROGRESS_STATUSES.indexOf(status),
        );
      }
    }
  });

  it('always returns a row the schema accepts', () => {
    for (const status of PROGRESS_STATUSES) {
      for (const event of PROGRESS_EVENTS) {
        const after = apply(at(status), event, { status: 'solved' });
        expect(problemProgressSchema.safeParse(after).success).toBe(true);
      }
    }
  });

  it('settles: applying the same event twice changes nothing but the attempt count', () => {
    for (const status of PROGRESS_STATUSES) {
      for (const event of PROGRESS_EVENTS) {
        const once = apply(at(status), event, { status: 'solved' });
        const twice = apply(once, event, { status: 'solved' });
        expect(twice.status).toBe(once.status);
        expect(twice.solvedAt).toBe(once.solvedAt);
        expect(twice.masteredAt).toBe(once.masteredAt);
      }
    }
  });

  it('stamps the caller time rather than reading a clock of its own', () => {
    const next = applyProgressEvent(initialProgress('pair-sum-index', 'python'), {
      event: 'submit_accepted',
      at: '2001-01-01T00:00:00.000Z',
    });
    expect(next.solvedAt).toBe('2001-01-01T00:00:00.000Z');
  });

  it('falls back to now when no time is given', () => {
    const before = Date.now();
    const next = applyProgressEvent(initialProgress('pair-sum-index', 'python'), { event: 'run' });
    const stamped = Date.parse(next.lastAttemptedAt ?? '');
    expect(stamped).toBeGreaterThanOrEqual(before);
    expect(stamped).toBeLessThanOrEqual(Date.now());
  });
});

describe('problemStatus roll-up', () => {
  it('takes the best status across languages (D11)', () => {
    expect(problemStatus([at('in_progress'), { ...at('solved'), language: 'java' }])).toBe(
      'solved',
    );
  });

  it('treats a problem with no rows as not started', () => {
    expect(problemStatus([])).toBe('not_started');
  });

  it('is a derived value, so a weaker language cannot drag it down', () => {
    expect(problemStatus([at('mastered'), { ...at('not_started'), language: 'java' }])).toBe(
      'mastered',
    );
  });
});
