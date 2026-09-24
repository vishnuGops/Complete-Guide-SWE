import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { loadMigrations } from './migrate.js';
import type { Database } from './open.js';

/**
 * Backing the practice history up, and putting one back (ROADMAP P8-3).
 *
 * The whole point of a local-first app is that the data is the user's, and data
 * that is the user's needs to be copyable. One file is the entire archive: every
 * submission, every status, every note.
 *
 * `VACUUM INTO` rather than copying the file, and that is the whole reason this
 * module exists. A live SQLite database is three files - the database, the
 * write-ahead log and its shared-memory index - and copying the first one while
 * the server is running produces a file that is missing whatever is still in the
 * log. `VACUUM INTO` asks SQLite for a consistent copy, which is correct while
 * the app is in use and is also smaller, because it rebuilds without free pages.
 */

/**
 * `devpromax-backup-2026-09-18T09-30-00.db`.
 *
 * Colons are legal in a filename on POSIX and not on Windows, so the timestamp
 * is punctuated with dashes; it still sorts chronologically, which is the one
 * property a backup name has to have.
 */
export function backupFilename(now = new Date()): string {
  return `devpromax-backup-${now.toISOString().replace(/[:.]/g, '-').replace(/Z$/, '')}.db`;
}

export interface BackupResult {
  file: string;
  bytes: number;
  /** A stored API key was in the database and was left out of the copy (P3-10). */
  keyOmitted: boolean;
}

export interface BackupOptions {
  /** Keep the coach API key in the copy. Off unless asked for (P3-10). */
  includeKey?: boolean;
}

/**
 * Writes a consistent copy of the database to `file`.
 *
 * Refuses to overwrite: a backup that silently replaced an older one would be a
 * way of losing two copies with one mistake.
 *
 * Without the API key, unless `includeKey` says otherwise (ROADMAP P3-10). The
 * key rests in the live database on purpose (D19): that file never leaves the
 * machine. A backup exists to leave it - a synced folder, a USB stick, an
 * email to yourself - and a secret the user did not think of as being in the
 * file is the one that leaks. Putting it back is one paste in Settings.
 */
export function backupTo(db: Database, file: string, options: BackupOptions = {}): BackupResult {
  const target = path.resolve(file);
  if (fs.existsSync(target)) {
    throw new Error(`${target} already exists; a backup will not overwrite a file.`);
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });

  // A bound parameter is not allowed here - VACUUM INTO takes a literal - so
  // the path is quoted the way SQLite quotes strings, by doubling the quotes.
  db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);

  let keyOmitted = false;
  if (options.includeKey !== true) {
    try {
      keyOmitted = scrubApiKey(target);
    } catch (error) {
      // A copy that may still hold the key is not a backup this command made.
      fs.rmSync(target, { force: true });
      throw error;
    }
  }

  return { file: target, bytes: fs.statSync(target).size, keyOmitted };
}

/**
 * Nulls the stored key in a copy, and makes sure its bytes are gone.
 *
 * An UPDATE alone is not enough: SQLite leaves the old row's bytes in the freed
 * space of the page, and a hex editor would find the key in a file that says it
 * has none. So the rewrite happens with `secure_delete` on, the journal kept in
 * memory rather than written beside the copy, and the file VACUUMed afterwards,
 * which rebuilds every page from the live rows.
 */
function scrubApiKey(file: string): boolean {
  const copy = new DatabaseSync(file);
  try {
    copy.exec('PRAGMA secure_delete = ON');
    copy.exec('PRAGMA journal_mode = MEMORY');
    copy.exec('PRAGMA temp_store = MEMORY');
    const changed = copy
      .prepare(
        `UPDATE settings SET value = json_set(value, '$.apiKey', json('null'))
          WHERE key = 'coach' AND json_valid(value)
            AND json_type(value, '$.apiKey') IS NOT NULL
            AND json_type(value, '$.apiKey') != 'null'`,
      )
      .run();
    copy.exec('VACUUM');
    return Number(changed.changes) > 0;
  } finally {
    copy.close();
  }
}

export interface RestoreCheck {
  ok: boolean;
  /** `user_version` of the candidate file, which is the migration version. */
  version: number;
  problem?: string;
}

/**
 * Whether a file is a DevProMax database this build can open.
 *
 * Checked before anything is moved, because "restore" that leaves the user with
 * neither their old data nor a working new copy is the worst possible outcome.
 * Three things are asked: is it SQLite at all, does it carry a schema version,
 * and is that version one this build understands - a backup from a *newer*
 * build is refused rather than silently downgraded.
 */
export function inspectBackup(file: string): RestoreCheck {
  // Read from the migrations on disk rather than from a constant: they are
  // numbered contiguously from 001 (see `loadMigrations`), so the last one is
  // the version this build understands, and there is nothing to keep in step.
  const understands = loadMigrations().at(-1)?.version ?? 0;

  if (!fs.existsSync(file)) return { ok: false, version: 0, problem: 'there is no such file' };

  /*
   * Everything below is inside one try, including the open.
   *
   * `new DatabaseSync` does not read the file - it is the first statement that
   * does, so a text file passed in here throws from `PRAGMA user_version`
   * rather than from the constructor. Catching only the constructor let "file
   * is not a database" escape as an exception, and the point of this function
   * is that it answers rather than throws.
   */
  let candidate: DatabaseSync | undefined;
  try {
    candidate = new DatabaseSync(file, { readOnly: true });

    const row = candidate.prepare('PRAGMA user_version').get() as
      { user_version?: number } | undefined;
    const version = Number(row?.user_version ?? 0);

    if (version === 0) {
      return { ok: false, version, problem: 'it carries no DevProMax schema version' };
    }
    if (version > understands) {
      return {
        ok: false,
        version,
        problem: `it was written by a newer build (schema ${String(version)}, this one understands ${String(understands)})`,
      };
    }

    // The tables the app cannot run without. A file with the right version and
    // none of them is someone else's database that happens to have a number in
    // it.
    const names = (
      candidate.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as {
        name: string;
      }[]
    ).map((entry) => entry.name);
    for (const table of ['submissions', 'problem_progress', 'settings']) {
      if (!names.includes(table)) {
        return { ok: false, version, problem: `it has no \`${table}\` table` };
      }
    }

    return { ok: true, version };
  } catch (error) {
    return {
      ok: false,
      version: 0,
      problem: `it is not a database SQLite can read (${error instanceof Error ? error.message : String(error)})`,
    };
  } finally {
    candidate?.close();
  }
}

export interface RestoreResult {
  from: string;
  to: string;
  /** Where the database that was replaced went, so it is never simply gone. */
  displaced: string;
}

/** Thrown when something still has the database open; the caller should stop it first. */
class DatabaseInUseError extends Error {
  constructor(file: string) {
    super(`${file} is in use. Stop DevProMax (and anything else using it) and try again.`);
    this.name = 'DatabaseInUseError';
  }
}

/**
 * Folds the write-ahead log into the database file before it is moved aside
 * (ROADMAP P3-10).
 *
 * The last transactions before a restore live in the `-wal` until a checkpoint
 * copies them into the main file, and the old restore deleted that log - so the
 * "previous database" it kept could be missing exactly the work that made
 * someone reach for a backup. `TRUNCATE` waits for nothing: if another
 * connection holds the file, it reports busy, and that is a running server.
 */
function checkpoint(file: string): void {
  let db: DatabaseSync | undefined;
  try {
    db = new DatabaseSync(file);
    const row = db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get() as
      { busy?: number } | undefined;
    if (Number(row?.busy ?? 0) !== 0) throw new DatabaseInUseError(file);
  } catch (error) {
    if (error instanceof DatabaseInUseError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    if (/locked|busy/i.test(message)) throw new DatabaseInUseError(file);
    // Anything else - a damaged file, a stray log that is not a log - is not a
    // reason to refuse: the files are moved together below, as they are.
  } finally {
    db?.close();
  }
}

/**
 * Puts a backup in place of the live database.
 *
 * The caller must have closed the database first - this moves files, and on
 * Windows an open handle makes that fail rather than corrupt anything, which is
 * the better of the two failures but still a failure.
 *
 * What is being replaced is moved aside rather than deleted. A restore is the
 * one operation in this app that destroys practice history, and the person
 * doing it has usually just realised something has gone wrong; leaving them a
 * second chance costs a rename.
 */
export function restoreFrom(source: string, target: string, now = new Date()): RestoreResult {
  const check = inspectBackup(source);
  if (!check.ok) throw new Error(`${source} cannot be restored: ${check.problem ?? 'unknown'}.`);

  const resolvedTarget = path.resolve(target);
  fs.mkdirSync(path.dirname(resolvedTarget), { recursive: true });

  const displaced = `${resolvedTarget}.replaced-${now.toISOString().replace(/[:.]/g, '-').replace(/Z$/, '')}`;
  if (fs.existsSync(resolvedTarget)) {
    checkpoint(resolvedTarget);
    try {
      fs.renameSync(resolvedTarget, displaced);
    } catch (error) {
      // Windows refuses to move a file another process has open. Nothing has
      // moved yet, so saying why is all that is needed.
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'EBUSY' || code === 'EPERM') throw new DatabaseInUseError(resolvedTarget);
      throw error;
    }
  }

  // And the write-ahead log with it - moved, not deleted (P3-10). Left where it
  // was, SQLite would replay it over the restored file; deleted, it could take
  // the displaced database's last writes with it. Beside the displaced file,
  // under its name, it is what SQLite looks for when that file is opened.
  for (const suffix of ['-wal', '-shm']) {
    const stray = `${resolvedTarget}${suffix}`;
    if (fs.existsSync(stray)) fs.renameSync(stray, `${displaced}${suffix}`);
  }

  fs.copyFileSync(path.resolve(source), resolvedTarget);
  return { from: path.resolve(source), to: resolvedTarget, displaced };
}
