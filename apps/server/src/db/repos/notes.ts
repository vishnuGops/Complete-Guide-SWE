import { nowIso, type Database } from '../open.js';
import { text, type Row } from './rows.js';

export interface Note {
  slug: string;
  body: string;
  updatedAt: string;
}

function toNote(row: Row): Note {
  return { slug: text(row, 'slug'), body: text(row, 'body'), updatedAt: text(row, 'updated_at') };
}

export interface NoteRepo {
  /** Upsert. An empty body deletes the note rather than storing a blank one. */
  save(slug: string, body: string): Note | null;
  get(slug: string): Note | null;
  list(): Note[];
  /** Substring search over bodies, for the "searchable from the list" in P7-4. */
  search(term: string): Note[];
  remove(slug: string): boolean;
}

export function createNoteRepo(db: Database): NoteRepo {
  const saveStmt = db.prepare(
    `INSERT INTO notes (slug, body, updated_at) VALUES (?, ?, ?)
     ON CONFLICT (slug) DO UPDATE SET body = excluded.body, updated_at = excluded.updated_at`,
  );
  const getStmt = db.prepare('SELECT slug, body, updated_at FROM notes WHERE slug = ?');
  const listStmt = db.prepare('SELECT slug, body, updated_at FROM notes ORDER BY updated_at DESC');
  const searchStmt = db.prepare(
    // instr() rather than LIKE: the search term is whatever the user typed, and
    // LIKE would read `%` and `_` in it as wildcards. Lowercasing both sides
    // makes the search case-insensitive for ASCII, which is what a note search
    // should be.
    `SELECT slug, body, updated_at FROM notes
     WHERE instr(lower(body), lower(?)) > 0
     ORDER BY updated_at DESC`,
  );
  const deleteStmt = db.prepare('DELETE FROM notes WHERE slug = ?');

  return {
    save(slug, body) {
      if (body.trim().length === 0) {
        deleteStmt.run(slug);
        return null;
      }
      const updatedAt = nowIso();
      saveStmt.run(slug, body, updatedAt);
      return { slug, body, updatedAt };
    },

    get(slug) {
      const row = getStmt.get(slug) as Row | undefined;
      return row ? toNote(row) : null;
    },

    list() {
      return (listStmt.all() as Row[]).map(toNote);
    },

    search(term) {
      return (searchStmt.all(term) as Row[]).map(toNote);
    },

    remove(slug) {
      return deleteStmt.run(slug).changes > 0;
    },
  };
}
