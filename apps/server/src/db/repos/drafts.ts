import { draftSchema, type Draft, type Language } from '@devpromax/shared';
import { nowIso, type Database } from '../open.js';
import { text, type Row } from './rows.js';

function toDraft(row: Row): Draft {
  return draftSchema.parse({
    slug: text(row, 'slug'),
    language: text(row, 'language'),
    code: text(row, 'code'),
    updatedAt: text(row, 'updated_at'),
  });
}

export interface DraftRepo {
  /** Upsert; returns the stored draft with its new timestamp. */
  save(slug: string, language: Language, code: string): Draft;
  get(slug: string, language: Language): Draft | null;
  listByProblem(slug: string): Draft[];
  /** Used by reset-to-starter, which should leave no draft behind. */
  remove(slug: string, language: Language): boolean;
  clear(): void;
}

export function createDraftRepo(db: Database): DraftRepo {
  const saveStmt = db.prepare(
    `INSERT INTO drafts (slug, language, code, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (slug, language) DO UPDATE SET code = excluded.code, updated_at = excluded.updated_at`,
  );
  const getStmt = db.prepare(
    'SELECT slug, language, code, updated_at FROM drafts WHERE slug = ? AND language = ?',
  );
  const listStmt = db.prepare(
    'SELECT slug, language, code, updated_at FROM drafts WHERE slug = ? ORDER BY language',
  );
  const deleteStmt = db.prepare('DELETE FROM drafts WHERE slug = ? AND language = ?');
  const clearStmt = db.prepare('DELETE FROM drafts');

  return {
    save(slug, language, code) {
      const updatedAt = nowIso();
      saveStmt.run(slug, language, code, updatedAt);
      // Saving a draft deliberately touches nothing else: status changes only on
      // Run, Submit, coach mastery or a manual override (D11).
      return { slug, language, code, updatedAt };
    },

    get(slug, language) {
      const row = getStmt.get(slug, language) as Row | undefined;
      return row ? toDraft(row) : null;
    },

    listByProblem(slug) {
      return (listStmt.all(slug) as Row[]).map(toDraft);
    },

    remove(slug, language) {
      return deleteStmt.run(slug, language).changes > 0;
    },

    clear() {
      clearStmt.run();
    },
  };
}
