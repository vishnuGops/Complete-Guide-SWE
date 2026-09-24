import { randomUUID } from 'node:crypto';
import type { InterviewStage } from '@devpromax/shared';
import { nowIso, type Database } from '../open.js';
import { nullableText, num, text, type Row } from './rows.js';

/**
 * Mock interview sittings (ROADMAP P9-1).
 *
 * Storage only, like every repository here. Which problems to ask, when the
 * clock has run out and what the debrief says are decided in
 * `api/services/interviewService.ts`; this puts rows in and takes rows out.
 */
export interface InterviewRow {
  id: string;
  slugs: string[];
  budgetMs: number;
  at: number;
  stage: InterviewStage;
  sessionId: string | null;
  debrief: string | null;
  createdAt: string;
  endedAt: string | null;
}

export interface NewInterview {
  slugs: readonly string[];
  budgetMs: number;
}

const COLUMNS = 'id, slugs, budget_ms, at, stage, session_id, debrief, created_at, ended_at';

function toInterview(row: Row): InterviewRow {
  let slugs: string[] = [];
  try {
    const parsed: unknown = JSON.parse(text(row, 'slugs'));
    slugs = Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    // An unreadable list leaves an interview with no problems, which the
    // service reports as finished rather than throwing on the way to a screen.
  }

  return {
    id: text(row, 'id'),
    slugs,
    budgetMs: num(row, 'budget_ms'),
    at: num(row, 'at'),
    stage: text(row, 'stage') as InterviewStage,
    sessionId: nullableText(row, 'session_id'),
    debrief: nullableText(row, 'debrief'),
    createdAt: text(row, 'created_at'),
    endedAt: nullableText(row, 'ended_at'),
  };
}

export interface InterviewRepo {
  create(interview: NewInterview): InterviewRow;
  get(id: string): InterviewRow | null;
  /** The most recent sitting, finished or not; the screen opens on it. */
  latest(): InterviewRow | null;
  update(
    id: string,
    patch: Partial<Pick<InterviewRow, 'at' | 'stage' | 'sessionId' | 'debrief' | 'endedAt'>>,
  ): InterviewRow | null;
  clear(): number;
}

export function createInterviewRepo(db: Database): InterviewRepo {
  const insertStmt = db.prepare(
    `INSERT INTO interviews (id, slugs, budget_ms, at, stage, created_at)
     VALUES (?, ?, ?, 0, 'approach', ?)`,
  );
  const getStmt = db.prepare(`SELECT ${COLUMNS} FROM interviews WHERE id = ?`);
  const latestStmt = db.prepare(
    `SELECT ${COLUMNS} FROM interviews ORDER BY created_at DESC, rowid DESC LIMIT 1`,
  );
  const clearStmt = db.prepare('DELETE FROM interviews');

  /*
   * One statement per field rather than a built-up SET clause.
   *
   * Five fields, each nullable, and a dynamic clause would mean assembling SQL
   * from keys - which is where an injection comes from even when the keys are
   * "obviously" internal. COALESCE keeps the ones not being set.
   */
  const updateStmt = db.prepare(
    `UPDATE interviews SET
       at = COALESCE(?, at),
       stage = COALESCE(?, stage),
       session_id = COALESCE(?, session_id),
       debrief = COALESCE(?, debrief),
       ended_at = COALESCE(?, ended_at)
     WHERE id = ?`,
  );

  return {
    create(interview) {
      const id = randomUUID();
      const createdAt = nowIso();
      insertStmt.run(id, JSON.stringify([...interview.slugs]), interview.budgetMs, createdAt);
      return {
        id,
        slugs: [...interview.slugs],
        budgetMs: interview.budgetMs,
        at: 0,
        stage: 'approach',
        sessionId: null,
        debrief: null,
        createdAt,
        endedAt: null,
      };
    },

    get(id) {
      const row = getStmt.get(id) as Row | undefined;
      return row ? toInterview(row) : null;
    },

    latest() {
      const row = latestStmt.get() as Row | undefined;
      return row ? toInterview(row) : null;
    },

    update(id, patch) {
      updateStmt.run(
        patch.at ?? null,
        patch.stage ?? null,
        patch.sessionId ?? null,
        patch.debrief ?? null,
        patch.endedAt ?? null,
        id,
      );
      const row = getStmt.get(id) as Row | undefined;
      return row ? toInterview(row) : null;
    },

    clear() {
      return Number(clearStmt.run().changes);
    },
  };
}
