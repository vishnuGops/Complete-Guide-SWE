import { problemProgressSchema, type Language, type ProblemProgress } from '@devpromax/shared';
import type { Database } from '../open.js';
import { nullableText, num, text, type Row } from './rows.js';

const COLUMNS = 'slug, language, status, attempts, solved_at, mastered_at, last_attempted_at';

function toProgress(row: Row): ProblemProgress {
  return problemProgressSchema.parse({
    slug: text(row, 'slug'),
    language: text(row, 'language'),
    status: text(row, 'status'),
    attempts: num(row, 'attempts'),
    solvedAt: nullableText(row, 'solved_at'),
    masteredAt: nullableText(row, 'mastered_at'),
    lastAttemptedAt: nullableText(row, 'last_attempted_at'),
  });
}

/**
 * Storage for progress rows, and nothing more.
 *
 * Deciding what a row becomes after a run, a submit or a coach verdict belongs
 * to the status engine (P3-3), which is a pure function precisely so that the
 * rule "a later Wrong Answer never demotes Solved" can be tested without a
 * database. This repository must never encode that rule a second time.
 */
export interface ProgressRepo {
  get(slug: string, language: Language): ProblemProgress | null;
  listByProblem(slug: string): ProblemProgress[];
  list(): ProblemProgress[];
  /** Writes the row exactly as given; the caller has already decided it. */
  put(progress: ProblemProgress): ProblemProgress;
  remove(slug: string, language: Language): boolean;
  /** Returns how many rows went, which reset-all-progress reports back. */
  clear(): number;
}

export function createProgressRepo(db: Database): ProgressRepo {
  const putStmt = db.prepare(
    `INSERT INTO problem_progress (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (slug, language) DO UPDATE SET
       status = excluded.status,
       attempts = excluded.attempts,
       solved_at = excluded.solved_at,
       mastered_at = excluded.mastered_at,
       last_attempted_at = excluded.last_attempted_at`,
  );
  const getStmt = db.prepare(
    `SELECT ${COLUMNS} FROM problem_progress WHERE slug = ? AND language = ?`,
  );
  const byProblemStmt = db.prepare(
    `SELECT ${COLUMNS} FROM problem_progress WHERE slug = ? ORDER BY language`,
  );
  const listStmt = db.prepare(`SELECT ${COLUMNS} FROM problem_progress ORDER BY slug, language`);
  const deleteStmt = db.prepare('DELETE FROM problem_progress WHERE slug = ? AND language = ?');
  const clearStmt = db.prepare('DELETE FROM problem_progress');

  return {
    get(slug, language) {
      const row = getStmt.get(slug, language) as Row | undefined;
      return row ? toProgress(row) : null;
    },

    listByProblem(slug) {
      return (byProblemStmt.all(slug) as Row[]).map(toProgress);
    },

    list() {
      return (listStmt.all() as Row[]).map(toProgress);
    },

    put(progress) {
      putStmt.run(
        progress.slug,
        progress.language,
        progress.status,
        progress.attempts,
        progress.solvedAt,
        progress.masteredAt,
        progress.lastAttemptedAt,
      );
      return progress;
    },

    remove(slug, language) {
      return deleteStmt.run(slug, language).changes > 0;
    },

    clear() {
      return Number(clearStmt.run().changes);
    },
  };
}
