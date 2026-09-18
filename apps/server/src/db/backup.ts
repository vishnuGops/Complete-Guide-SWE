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
}

/**
 * Writes a consistent copy of the database to `file`.
 *
 * Refuses to overwrite: a backup that silently replaced an older one would be a
 * way of losing two copies with one mistake.
 */
export function backupTo(db: Database, file: string): BackupResult {
  const target = path.resolve(file);
  if (fs.existsSync(target)) {
    throw new Error(`${target} already exists; a backup will not overwrite a file.`);
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });

  // A bound parameter is not allowed here - VACUUM INTO takes a literal - so
  // the path is quoted the way SQLite quotes strings, by doubling the quotes.
  db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);

  return { file: target, bytes: fs.statSync(target).size };
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
  if (fs.existsSync(resolvedTarget)) fs.renameSync(resolvedTarget, displaced);

  // And the write-ahead log with it: leaving a `-wal` behind from the database
  // that was just moved would let SQLite replay it over the restored file.
  for (const suffix of ['-wal', '-shm']) {
    const stray = `${resolvedTarget}${suffix}`;
    if (fs.existsSync(stray)) fs.rmSync(stray);
  }

  fs.copyFileSync(path.resolve(source), resolvedTarget);
  return { from: path.resolve(source), to: resolvedTarget, displaced };
}
