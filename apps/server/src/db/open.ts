import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { paths } from '../config.js';

/**
 * Opening a connection and migrating it are separate on purpose: this module
 * knows nothing about migrations, which is what keeps `migrate.ts` free to use
 * `transaction` from here without the two importing each other. `createDatabase`
 * in `./index.ts` is the pairing everything outside this folder should use.
 *
 * The database handle used everywhere in the server.
 *
 * `node:sqlite` is synchronous by design (D14), and so is every repository built
 * on it. For a single-user local app that is a feature rather than a compromise:
 * a read is a function call, there is no pool to exhaust, and "did this write
 * land before that read" stops being a question anyone has to ask.
 */
export type Database = DatabaseSync;

/** Tests pass this to get a throwaway database with the real schema. */
export const IN_MEMORY = ':memory:';

export interface OpenOptions {
  /** Database file, or `IN_MEMORY`. Defaults to `data/devpromax.db`. */
  file?: string;
}

export function openDatabase(options: OpenOptions = {}): Database {
  /*
   * A test that forgets to pass a file must fail, not quietly migrate the
   * owner's practice history (ROADMAP P3-8). `hardening.test.ts` did exactly
   * that for months: it built the server without `repositories`, so every run
   * opened and migrated the real `data/devpromax.db`. Vitest sets VITEST in
   * every worker; a test that means to use a file says which one.
   */
  if (options.file === undefined && process.env.VITEST !== undefined) {
    throw new Error(
      `openDatabase() was called without a file under Vitest, which would open ${paths.db}. ` +
        'Pass { file: IN_MEMORY } or a temporary path.',
    );
  }
  const file = options.file ?? paths.db;

  if (file !== IN_MEMORY) {
    // data/ is gitignored, so on a fresh clone it does not exist yet.
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }

  const db = new DatabaseSync(file);

  // Enforced per connection, not stored in the file: SQLite defaults foreign
  // keys *off*, which would silently turn coach_messages' cascade into a no-op.
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');

  if (file !== IN_MEMORY) {
    // WAL lets the UI read while a submit is being written. It needs a real file
    // (an in-memory database silently stays in "memory" journal mode), and it is
    // the reason `synchronous = NORMAL` is safe here: a crash can lose the last
    // transaction but cannot corrupt the database.
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA synchronous = NORMAL');
  }

  return db;
}

/**
 * Runs `fn` inside a transaction, rolling back if it throws.
 *
 * Does not nest: SQLite has no nested transactions, and savepoints would hide
 * the fact that the inner block cannot actually be rolled back independently.
 * Repositories therefore never call this from inside another `transaction`.
 */
export function transaction<T>(db: Database, fn: () => T): T {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // The transaction was already gone (a failed BEGIN, or a statement that
      // rolled back on its own). The original error is the one worth reporting.
    }
    throw error;
  }
}

/** ISO-8601 UTC, the only timestamp format this database stores. */
export function nowIso(): string {
  return new Date().toISOString();
}
