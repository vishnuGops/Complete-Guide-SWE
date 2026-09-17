import type { JsonValue, Language } from '@devpromax/shared';
import { nowIso, type Database } from '../open.js';
import { json, nullableText, num, text, type Row } from './rows.js';

/**
 * Activity types recorded so far. Kept in TypeScript rather than as a CHECK
 * constraint (see 001_initial.sql): nothing branches on this value, it is only
 * counted and grouped for streaks and the dashboard, so a new kind of activity
 * should not cost a schema migration.
 */
export const ACTIVITY_EVENTS = [
  'run',
  'submit',
  'coach_feedback',
  'hint_revealed',
  'editorial_revealed',
  'status_override',
] as const;
export type ActivityEvent = (typeof ACTIVITY_EVENTS)[number];

export interface ActivityRecord {
  id: number;
  type: ActivityEvent;
  slug: string | null;
  language: Language | null;
  payload: JsonValue | null;
  createdAt: string;
}

export interface NewActivity {
  type: ActivityEvent;
  slug?: string;
  language?: Language;
  payload?: JsonValue;
  /** Overridable so a caller can record an event at the time it actually happened. */
  createdAt?: string;
}

export interface ActivityQuery {
  slug?: string;
  /** Inclusive ISO-8601 lower bound; the dashboard asks for "the last 365 days". */
  since?: string;
  limit?: number;
}

/** One calendar day's activity count, for the streak calendar (P7-5). */
export interface DailyCount {
  day: string;
  count: number;
}

function toRecord(row: Row): ActivityRecord {
  return {
    id: num(row, 'id'),
    type: text(row, 'type') as ActivityEvent,
    slug: nullableText(row, 'slug'),
    language: nullableText(row, 'language') as Language | null,
    payload: json<JsonValue | null>(row, 'payload', null),
    createdAt: text(row, 'created_at'),
  };
}

export interface EventRepo {
  record(event: NewActivity): ActivityRecord;
  list(query?: ActivityQuery): ActivityRecord[];
  /** Counts per UTC day, newest first. */
  dailyCounts(since?: string): DailyCount[];
  /** Returns how many rows went, which reset-all-progress reports back. */
  clear(): number;
}

export function createEventRepo(db: Database): EventRepo {
  const insertStmt = db.prepare(
    'INSERT INTO events (type, slug, language, payload, created_at) VALUES (?, ?, ?, ?, ?)',
  );
  const clearStmt = db.prepare('DELETE FROM events');

  return {
    record(event) {
      const createdAt = event.createdAt ?? nowIso();
      const payload = event.payload === undefined ? null : JSON.stringify(event.payload);
      const result = insertStmt.run(
        event.type,
        event.slug ?? null,
        event.language ?? null,
        payload,
        createdAt,
      );
      return {
        id: Number(result.lastInsertRowid),
        type: event.type,
        slug: event.slug ?? null,
        language: event.language ?? null,
        payload: event.payload ?? null,
        createdAt,
      };
    },

    list(query = {}) {
      const where: string[] = [];
      const params: string[] = [];
      if (query.slug !== undefined) {
        where.push('slug = ?');
        params.push(query.slug);
      }
      if (query.since !== undefined) {
        where.push('created_at >= ?');
        params.push(query.since);
      }

      const sql =
        'SELECT id, type, slug, language, payload, created_at FROM events' +
        (where.length > 0 ? ` WHERE ${where.join(' AND ')}` : '') +
        ' ORDER BY created_at DESC, id DESC' +
        (query.limit !== undefined ? ' LIMIT ?' : '');

      const stmt = db.prepare(sql);
      const rows = (
        query.limit !== undefined ? stmt.all(...params, query.limit) : stmt.all(...params)
      ) as Row[];
      return rows.map(toRecord);
    },

    dailyCounts(since) {
      // The first ten characters of an ISO-8601 UTC timestamp are its date, so
      // the grouping needs no date functions and no timezone assumptions beyond
      // the one this database already makes everywhere: timestamps are UTC.
      const sql =
        'SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS n FROM events' +
        (since !== undefined ? ' WHERE created_at >= ?' : '') +
        ' GROUP BY day ORDER BY day DESC';
      const stmt = db.prepare(sql);
      const rows = (since !== undefined ? stmt.all(since) : stmt.all()) as Row[];
      return rows.map((row) => ({ day: text(row, 'day'), count: num(row, 'n') }));
    },

    clear() {
      return Number(clearStmt.run().changes);
    },
  };
}
