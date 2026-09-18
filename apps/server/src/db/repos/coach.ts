import { randomUUID } from 'node:crypto';
import { coachFeedbackSchema, type CoachFeedback, type Language } from '@devpromax/shared';
import { nowIso, transaction, type Database } from '../open.js';
import { nullableNumber, nullableText, text, type Row } from './rows.js';

export const COACH_ROLES = ['user', 'coach'] as const;
export type CoachRole = (typeof COACH_ROLES)[number];

export interface CoachSession {
  id: string;
  slug: string;
  language: Language;
  createdAt: string;
  updatedAt: string;
}

export interface CoachMessage {
  id: string;
  sessionId: string;
  role: CoachRole;
  content: string;
  /** Present only on the structured feedback turns, not on plain chat. */
  feedback: CoachFeedback | null;
  /** The code that was in the editor when this turn was asked for (P5-5). */
  code: string | null;
  /** USD this turn cost, or null when the vendor reported no usage (P5-6). */
  costUsd: number | null;
  createdAt: string;
}

export interface NewCoachMessage {
  role: CoachRole;
  content: string;
  feedback?: CoachFeedback;
  code?: string;
  costUsd?: number;
}

function toSession(row: Row): CoachSession {
  return {
    id: text(row, 'id'),
    slug: text(row, 'slug'),
    language: text(row, 'language') as Language,
    createdAt: text(row, 'created_at'),
    updatedAt: text(row, 'updated_at'),
  };
}

function toMessage(row: Row): CoachMessage {
  const raw = nullableText(row, 'feedback');
  return {
    id: text(row, 'id'),
    sessionId: text(row, 'session_id'),
    role: text(row, 'role') as CoachRole,
    content: text(row, 'content'),
    feedback: raw === null ? null : coachFeedbackSchema.parse(JSON.parse(raw)),
    code: nullableText(row, 'code'),
    costUsd: nullableNumber(row, 'cost_usd'),
    createdAt: text(row, 'created_at'),
  };
}

export interface CoachRepo {
  createSession(slug: string, language: Language): CoachSession;
  getSession(id: string): CoachSession | null;
  /** The conversation the AI Help button continues, or null if there is none yet. */
  latestSession(slug: string, language: Language): CoachSession | null;
  listSessions(slug: string): CoachSession[];
  addMessage(sessionId: string, message: NewCoachMessage): CoachMessage;
  listMessages(sessionId: string): CoachMessage[];
  /** Feedback turns for a problem, newest first - the input to P5-5's attempt memory. */
  recentFeedback(slug: string, language: Language, limit: number): CoachMessage[];
  /** What this conversation has cost so far, for the spend cap (P5-6). */
  sessionSpendUsd(sessionId: string): number;
  deleteSession(id: string): boolean;
  /** Drops every conversation; messages go with them by cascade. */
  clearSessions(): number;
}

const MESSAGE_COLUMNS = 'id, session_id, role, content, feedback, code, cost_usd, created_at';
const SESSION_COLUMNS = 'id, slug, language, created_at, updated_at';

export function createCoachRepo(db: Database): CoachRepo {
  const insertSession = db.prepare(
    `INSERT INTO coach_sessions (${SESSION_COLUMNS}) VALUES (?, ?, ?, ?, ?)`,
  );
  const getSession = db.prepare(`SELECT ${SESSION_COLUMNS} FROM coach_sessions WHERE id = ?`);
  const latestSession = db.prepare(
    `SELECT ${SESSION_COLUMNS} FROM coach_sessions
     WHERE slug = ? AND language = ?
     ORDER BY created_at DESC, rowid DESC LIMIT 1`,
  );
  const listSessions = db.prepare(
    `SELECT ${SESSION_COLUMNS} FROM coach_sessions WHERE slug = ? ORDER BY created_at DESC`,
  );
  const insertMessage = db.prepare(
    `INSERT INTO coach_messages (${MESSAGE_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const touchSession = db.prepare('UPDATE coach_sessions SET updated_at = ? WHERE id = ?');
  const listMessages = db.prepare(
    `SELECT ${MESSAGE_COLUMNS} FROM coach_messages WHERE session_id = ? ORDER BY created_at, rowid`,
  );
  const recentFeedback = db.prepare(
    `SELECT m.id, m.session_id, m.role, m.content, m.feedback, m.code, m.cost_usd, m.created_at
     FROM coach_messages m
     JOIN coach_sessions s ON s.id = m.session_id
     WHERE s.slug = ? AND s.language = ? AND m.feedback IS NOT NULL
     ORDER BY m.created_at DESC, m.rowid DESC
     LIMIT ?`,
  );
  const sessionSpend = db.prepare(
    'SELECT COALESCE(SUM(cost_usd), 0) AS total FROM coach_messages WHERE session_id = ?',
  );
  const deleteSession = db.prepare('DELETE FROM coach_sessions WHERE id = ?');
  const clearSessions = db.prepare('DELETE FROM coach_sessions');

  return {
    createSession(slug, language) {
      const now = nowIso();
      const session: CoachSession = {
        id: randomUUID(),
        slug,
        language,
        createdAt: now,
        updatedAt: now,
      };
      insertSession.run(
        session.id,
        session.slug,
        session.language,
        session.createdAt,
        session.updatedAt,
      );
      return session;
    },

    getSession(id) {
      const row = getSession.get(id) as Row | undefined;
      return row ? toSession(row) : null;
    },

    latestSession(slug, language) {
      const row = latestSession.get(slug, language) as Row | undefined;
      return row ? toSession(row) : null;
    },

    listSessions(slug) {
      return (listSessions.all(slug) as Row[]).map(toSession);
    },

    addMessage(sessionId, message) {
      const createdAt = nowIso();
      const id = randomUUID();
      const feedback = message.feedback ? JSON.stringify(message.feedback) : null;

      // The message and its session's updated_at move together, so "most recent
      // conversation" cannot be answered differently depending on which of the
      // two writes a reader happened to catch.
      transaction(db, () => {
        insertMessage.run(
          id,
          sessionId,
          message.role,
          message.content,
          feedback,
          message.code ?? null,
          message.costUsd ?? null,
          createdAt,
        );
        touchSession.run(createdAt, sessionId);
      });

      return {
        id,
        sessionId,
        role: message.role,
        content: message.content,
        feedback: message.feedback ?? null,
        code: message.code ?? null,
        costUsd: message.costUsd ?? null,
        createdAt,
      };
    },

    listMessages(sessionId) {
      return (listMessages.all(sessionId) as Row[]).map(toMessage);
    },

    recentFeedback(slug, language, limit) {
      return (recentFeedback.all(slug, language, limit) as Row[]).map(toMessage);
    },

    sessionSpendUsd(sessionId) {
      const row = sessionSpend.get(sessionId) as Row | undefined;
      const total = row?.['total'];
      return typeof total === 'number' ? total : 0;
    },

    deleteSession(id) {
      // coach_messages cascades (and PRAGMA foreign_keys is ON per connection).
      return deleteSession.run(id).changes > 0;
    },

    clearSessions() {
      return Number(clearSessions.run().changes);
    },
  };
}
