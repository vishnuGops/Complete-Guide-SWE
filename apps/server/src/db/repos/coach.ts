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

/** One scored turn, with the problem it was about (ROADMAP P7-5). */
export interface ScoredTurn {
  slug: string;
  language: Language;
  feedback: CoachFeedback;
  createdAt: string;
}

/** What a conversation has spent, and how many turns nobody could price (P5-9). */
export interface SessionSpend {
  reportedUsd: number;
  unreportedTurns: number;
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
  /**
   * What this conversation has cost so far, for the spend cap (P5-6, P5-9).
   *
   * Two numbers rather than one, because a turn can end without the vendor ever
   * reporting what it used - a timeout, a cancelled request - and its row
   * carries a NULL cost. Summing those as zero made the cap ignore exactly the
   * turns that went wrong, so the caller prices them itself (`unreportedTurns`)
   * at the dearest rate known for the provider.
   */
  sessionSpend(sessionId: string): SessionSpend;
  /**
   * Attaches a cost to a message that was written before the cost was known.
   *
   * The turn a user cancels is the case: its answer is never persisted, but the
   * tokens it spent are real and the cap has to see them, so the cost lands on
   * the context row the turn started with (P5-9).
   */
  setMessageCost(id: string, costUsd: number): boolean;
  /**
   * Every scored turn, with the problem it was about (ROADMAP P7-5).
   *
   * The dashboard averages these per topic to say which topics are weakest, so
   * it needs all of them rather than the most recent few - and needs the slug,
   * which lives on the session rather than on the message.
   */
  scoredTurns(): ScoredTurn[];
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
  const scoredTurns = db.prepare(
    `SELECT s.slug, s.language, m.feedback, m.created_at
     FROM coach_messages m
     JOIN coach_sessions s ON s.id = m.session_id
     WHERE m.feedback IS NOT NULL
     ORDER BY m.created_at, m.rowid`,
  );
  const sessionSpend = db.prepare(
    `SELECT COALESCE(SUM(cost_usd), 0) AS total,
            SUM(CASE WHEN cost_usd IS NULL AND role = 'coach' THEN 1 ELSE 0 END) AS unpriced
     FROM coach_messages WHERE session_id = ?`,
  );
  /*
   * The turn that never got a reply (ROADMAP P5-9).
   *
   * A turn cancelled or failed after the vendor was contacted leaves its
   * context row with no coach row after it, and the cost - if the vendor said
   * anything before it stopped - on that context row. When it said nothing, the
   * row is unpriced and the caller charges it at the dearest known rate, the
   * same as an unpriced answer. Only the *last* row can be in this state, which
   * is what keeps this a cheap lookup rather than a self-join.
   */
  const danglingTurn = db.prepare(
    `SELECT role, cost_usd FROM coach_messages
     WHERE session_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1`,
  );
  const setMessageCost = db.prepare('UPDATE coach_messages SET cost_usd = ? WHERE id = ?');
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

    scoredTurns() {
      return (scoredTurns.all() as Row[]).map((row) => ({
        slug: text(row, 'slug'),
        language: text(row, 'language') as Language,
        feedback: coachFeedbackSchema.parse(JSON.parse(text(row, 'feedback'))),
        createdAt: text(row, 'created_at'),
      }));
    },

    sessionSpend(sessionId) {
      const row = sessionSpend.get(sessionId) as Row | undefined;
      const total = row?.['total'];
      const unpriced = row?.['unpriced'];

      const last = danglingTurn.get(sessionId) as Row | undefined;
      const dangling = last !== undefined && last['role'] === 'user' && last['cost_usd'] === null;

      return {
        reportedUsd: typeof total === 'number' ? total : 0,
        unreportedTurns: (typeof unpriced === 'number' ? unpriced : 0) + (dangling ? 1 : 0),
      };
    },

    setMessageCost(id, costUsd) {
      return setMessageCost.run(costUsd, id).changes > 0;
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
