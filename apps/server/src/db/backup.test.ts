import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { backupFilename, backupTo, inspectBackup, restoreFrom } from './backup.js';
import { createDatabase, type Repositories } from './index.js';

/**
 * Backup and restore (ROADMAP P8-3).
 *
 * On disk rather than in memory, because the whole subject is files: a
 * consistent copy of a live database, a candidate file that might be somebody
 * else's, and a restore that must not leave the user with neither copy.
 */

let dir: string;
let dbFile: string;
let repos: Repositories;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'devpromax-backup-'));
  dbFile = path.join(dir, 'devpromax.db');
  repos = createDatabase({ file: dbFile });
});

afterEach(() => {
  try {
    repos.close();
  } catch {
    // Already closed by a test that needed it closed.
  }
  fs.rmSync(dir, { recursive: true, force: true });
});

/** One submission, so a restored file can be told apart from an empty one. */
function aSubmission(slug: string) {
  return repos.submissions.insert({
    slug,
    language: 'python',
    code: 'x = 1',
    verdict: 'AC',
    passed: 1,
    total: 1,
    timeMs: 1,
    problemVersion: 1,
    solveMs: null,
  });
}

describe('backupFilename', () => {
  it('sorts chronologically and is legal on Windows', () => {
    const name = backupFilename(new Date('2026-09-18T09:30:00.000Z'));

    expect(name).toBe('devpromax-backup-2026-09-18T09-30-00-000.db');
    // A colon is legal in a POSIX filename and not in a Windows one.
    expect(name).not.toContain(':');
    expect(
      backupFilename(new Date('2026-09-18T09:00:00.000Z')) <
        backupFilename(new Date('2026-09-18T10:00:00.000Z')),
    ).toBe(true);
  });
});

describe('backupTo', () => {
  it('writes a copy that carries the data', () => {
    aSubmission('pair-sum-index');

    const target = path.join(dir, 'copy.db');
    const result = backupTo(repos.db, target);

    expect(result.file).toBe(target);
    expect(result.bytes).toBeGreaterThan(0);

    const copy = createDatabase({ file: target });
    expect(copy.submissions.list()).toHaveLength(1);
    copy.close();
  });

  it('is consistent while the database is open and being written', () => {
    // The reason this module exists: a live SQLite database is three files, and
    // copying the first one leaves behind whatever is still in the write-ahead
    // log. `VACUUM INTO` asks SQLite for a copy instead.
    aSubmission('pair-sum-index');
    const target = path.join(dir, 'live.db');
    backupTo(repos.db, target);
    aSubmission('shift-right-in-place');

    const copy = createDatabase({ file: target });
    // The backup has what existed when it was taken - one row - and not the
    // row written after it.
    expect(copy.submissions.list().map((row) => row.slug)).toEqual(['pair-sum-index']);
    copy.close();
  });

  it('refuses to overwrite, because that loses two copies at once', () => {
    const target = path.join(dir, 'taken.db');
    fs.writeFileSync(target, 'not a database');

    expect(() => backupTo(repos.db, target)).toThrow(/already exists/);
    expect(fs.readFileSync(target, 'utf8')).toBe('not a database');
  });

  it('creates the directory it was pointed at', () => {
    const target = path.join(dir, 'nested', 'deeper', 'copy.db');
    backupTo(repos.db, target);
    expect(fs.existsSync(target)).toBe(true);
  });
});

describe('inspectBackup', () => {
  it('accepts a database this build wrote', () => {
    const target = path.join(dir, 'good.db');
    backupTo(repos.db, target);

    const check = inspectBackup(target);
    expect(check.ok).toBe(true);
    expect(check.version).toBeGreaterThan(0);
  });

  it('refuses a file that is not a database', () => {
    const target = path.join(dir, 'notes.txt');
    fs.writeFileSync(target, 'hello');
    expect(inspectBackup(target).ok).toBe(false);
  });

  it('refuses a database that is not ours', () => {
    // Right file format, no schema version: somebody else's SQLite file.
    const target = path.join(dir, 'stranger.db');
    const stranger = new DatabaseSync(target);
    stranger.exec('CREATE TABLE things (x)');
    stranger.close();

    const check = inspectBackup(target);
    expect(check.ok).toBe(false);
    expect(check.problem).toContain('no DevProMax schema version');
  });

  it('refuses one written by a newer build rather than downgrading it', () => {
    const target = path.join(dir, 'future.db');
    backupTo(repos.db, target);
    const future = new DatabaseSync(target);
    future.exec('PRAGMA user_version = 9999');
    future.close();

    const check = inspectBackup(target);
    expect(check.ok).toBe(false);
    expect(check.problem).toContain('newer build');
  });

  it('refuses a versioned file with none of our tables', () => {
    const target = path.join(dir, 'pretender.db');
    const pretender = new DatabaseSync(target);
    pretender.exec('PRAGMA user_version = 1');
    pretender.exec('CREATE TABLE things (x)');
    pretender.close();

    expect(inspectBackup(target).problem).toContain('submissions');
  });

  it('says so about a file that is not there', () => {
    expect(inspectBackup(path.join(dir, 'nope.db')).problem).toContain('no such file');
  });
});

describe('restoreFrom', () => {
  it('puts the backup in place and keeps what it replaced', () => {
    aSubmission('pair-sum-index');
    const backup = path.join(dir, 'before.db');
    backupTo(repos.db, backup);

    aSubmission('shift-right-in-place');
    repos.close();

    const result = restoreFrom(backup, dbFile, new Date('2026-09-18T09:30:00.000Z'));

    // A restore is the one operation here that destroys practice history, and
    // the person doing it has usually just realised something went wrong.
    expect(fs.existsSync(result.displaced)).toBe(true);

    const restored = createDatabase({ file: dbFile });
    expect(restored.submissions.list().map((row) => row.slug)).toEqual(['pair-sum-index']);
    restored.close();
  });

  it('clears a stale write-ahead log so it cannot be replayed over the restore', () => {
    aSubmission('pair-sum-index');
    const backup = path.join(dir, 'before.db');
    backupTo(repos.db, backup);
    repos.close();

    // A `-wal` left behind from the database that was moved aside would be
    // replayed into the restored file the next time it is opened.
    fs.writeFileSync(`${dbFile}-wal`, 'stale');
    restoreFrom(backup, dbFile);

    expect(fs.existsSync(`${dbFile}-wal`)).toBe(false);
  });

  it('refuses before it moves anything', () => {
    aSubmission('pair-sum-index');
    repos.close();
    const notABackup = path.join(dir, 'notes.txt');
    fs.writeFileSync(notABackup, 'hello');

    expect(() => restoreFrom(notABackup, dbFile)).toThrow(/cannot be restored/);

    // The live database is untouched: this is the failure that must not cost
    // the user both copies.
    const still = createDatabase({ file: dbFile });
    expect(still.submissions.list()).toHaveLength(1);
    still.close();
  });

  it('restores into a place that does not exist yet', () => {
    const backup = path.join(dir, 'fresh.db');
    backupTo(repos.db, backup);
    repos.close();

    const target = path.join(dir, 'elsewhere', 'devpromax.db');
    restoreFrom(backup, target);
    expect(fs.existsSync(target)).toBe(true);
  });
});
