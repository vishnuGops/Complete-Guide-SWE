import { randomUUID } from 'node:crypto';
import { submissionSchema, type Language, type Submission, type Verdict } from '@devpromax/shared';
import { nowIso, type Database } from '../open.js';
import { num, text, type Row } from './rows.js';

/** Everything a submission needs except the identity and timestamp the repo assigns. */
export interface NewSubmission {
  slug: string;
  language: Language;
  code: string;
  verdict: Verdict;
  passed: number;
  total: number;
  timeMs: number;
  problemVersion: number;
}

export interface SubmissionQuery {
  slug?: string;
  language?: Language;
  limit?: number;
}

function toSubmission(row: Row): Submission {
  return submissionSchema.parse({
    id: text(row, 'id'),
    slug: text(row, 'slug'),
    language: text(row, 'language'),
    code: text(row, 'code'),
    verdict: text(row, 'verdict'),
    passed: num(row, 'passed'),
    total: num(row, 'total'),
    timeMs: num(row, 'time_ms'),
    problemVersion: num(row, 'problem_version'),
    createdAt: text(row, 'created_at'),
  });
}

const COLUMNS =
  'id, slug, language, code, verdict, passed, total, time_ms, problem_version, created_at';

export interface SubmissionRepo {
  insert(submission: NewSubmission): Submission;
  get(id: string): Submission | null;
  list(query?: SubmissionQuery): Submission[];
  /** The newest accepted submission, used to seed the editorial diff and mastery check. */
  latestAccepted(slug: string, language: Language): Submission | null;
  countByProblem(slug: string): number;
}

export function createSubmissionRepo(db: Database): SubmissionRepo {
  const insertStmt = db.prepare(
    `INSERT INTO submissions (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const getStmt = db.prepare(`SELECT ${COLUMNS} FROM submissions WHERE id = ?`);
  const countStmt = db.prepare('SELECT COUNT(*) AS n FROM submissions WHERE slug = ?');
  const latestAcceptedStmt = db.prepare(
    `SELECT ${COLUMNS} FROM submissions
     WHERE slug = ? AND language = ? AND verdict = 'AC'
     ORDER BY created_at DESC, rowid DESC
     LIMIT 1`,
  );

  return {
    insert(submission) {
      const row: Submission = {
        ...submission,
        id: randomUUID(),
        createdAt: nowIso(),
      };
      insertStmt.run(
        row.id,
        row.slug,
        row.language,
        row.code,
        row.verdict,
        row.passed,
        row.total,
        row.timeMs,
        row.problemVersion,
        row.createdAt,
      );
      return row;
    },

    get(id) {
      const row = getStmt.get(id) as Row | undefined;
      return row ? toSubmission(row) : null;
    },

    list(query = {}) {
      const where: string[] = [];
      const params: string[] = [];
      if (query.slug !== undefined) {
        where.push('slug = ?');
        params.push(query.slug);
      }
      if (query.language !== undefined) {
        where.push('language = ?');
        params.push(query.language);
      }

      // rowid breaks ties: two submissions can share a millisecond, and history
      // that reorders itself between reads is worse than history that is wrong.
      const sql =
        `SELECT ${COLUMNS} FROM submissions` +
        (where.length > 0 ? ` WHERE ${where.join(' AND ')}` : '') +
        ' ORDER BY created_at DESC, rowid DESC' +
        (query.limit !== undefined ? ' LIMIT ?' : '');

      const stmt = db.prepare(sql);
      const rows = (
        query.limit !== undefined ? stmt.all(...params, query.limit) : stmt.all(...params)
      ) as Row[];
      return rows.map(toSubmission);
    },

    latestAccepted(slug, language) {
      const row = latestAcceptedStmt.get(slug, language) as Row | undefined;
      return row ? toSubmission(row) : null;
    },

    countByProblem(slug) {
      const row = countStmt.get(slug) as Row | undefined;
      return row ? num(row, 'n') : 0;
    },
  };
}
