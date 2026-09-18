import { nowIso, type Database } from '../open.js';
import { text, type Row } from './rows.js';

/**
 * Starred problems (ROADMAP P7-7).
 *
 * Per problem, not per language, and deliberately not part of progress: a
 * bookmark is something the user wrote down rather than something the app
 * recorded about them, so it survives reset-all-progress the way a note does.
 */
export interface Bookmark {
  slug: string;
  createdAt: string;
}

export interface BookmarkRepo {
  /** Idempotent: starring an already-starred problem keeps the original date. */
  add(slug: string): Bookmark;
  remove(slug: string): boolean;
  has(slug: string): boolean;
  /** Newest first, which is the order the command palette lists them in. */
  list(): Bookmark[];
  slugs(): Set<string>;
}

function toBookmark(row: Row): Bookmark {
  return { slug: text(row, 'slug'), createdAt: text(row, 'created_at') };
}

export function createBookmarkRepo(db: Database): BookmarkRepo {
  // DO NOTHING rather than an update: the date is when the user first meant to
  // come back to it, and a second click on an already-starred problem (which
  // the UI makes easy) should not quietly reorder the list.
  const addStmt = db.prepare(
    'INSERT INTO bookmarks (slug, created_at) VALUES (?, ?) ON CONFLICT (slug) DO NOTHING',
  );
  const getStmt = db.prepare('SELECT slug, created_at FROM bookmarks WHERE slug = ?');
  const deleteStmt = db.prepare('DELETE FROM bookmarks WHERE slug = ?');
  const listStmt = db.prepare('SELECT slug, created_at FROM bookmarks ORDER BY created_at DESC');

  return {
    add(slug) {
      addStmt.run(slug, nowIso());
      const row = getStmt.get(slug) as Row | undefined;
      // The row is there either way; reading it back is what makes the answer
      // the stored date rather than the one this call would have written.
      return row ? toBookmark(row) : { slug, createdAt: nowIso() };
    },

    remove(slug) {
      return deleteStmt.run(slug).changes > 0;
    },

    has(slug) {
      return getStmt.get(slug) !== undefined;
    },

    list() {
      return (listStmt.all() as Row[]).map(toBookmark);
    },

    slugs() {
      return new Set((listStmt.all() as Row[]).map((row) => text(row, 'slug')));
    },
  };
}
