import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { currentVersion, loadMigrations, migrate, MIGRATIONS_DIR } from './migrate.js';
import { IN_MEMORY, openDatabase, type Database } from './open.js';

const temps: string[] = [];

function migrationDir(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'devpromax-migrations-'));
  temps.push(dir);
  for (const [name, sql] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), sql, 'utf8');
  }
  return dir;
}

function tableNames(db: Database): string[] {
  const rows = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .all() as { name: string }[];
  return rows.map((row) => row.name);
}

afterEach(() => {
  for (const dir of temps.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('loadMigrations', () => {
  it('reads the checked-in migrations in version order', () => {
    const migrations = loadMigrations();
    expect(migrations.length).toBeGreaterThan(0);
    expect(migrations.map((m) => m.version)).toEqual(migrations.map((_, i) => i + 1));
    expect(migrations[0]?.file).toBe('001_initial.sql');
  });

  it('rejects a file that is not named NNN_name.sql', () => {
    const dir = migrationDir({ '001_initial.sql': 'CREATE TABLE a (x);', 'oops.sql': 'SELECT 1;' });
    expect(() => loadMigrations(dir)).toThrow(/NNN_snake_case\.sql/);
  });

  it('rejects a gap in the version sequence', () => {
    const dir = migrationDir({
      '001_a.sql': 'CREATE TABLE a (x);',
      '003_c.sql': 'CREATE TABLE c (x);',
    });
    expect(() => loadMigrations(dir)).toThrow(/contiguous/);
  });

  // The mistake this rule exists for: two branches each adding an 002_.
  it('rejects two migrations claiming the same version', () => {
    const dir = migrationDir({
      '001_a.sql': 'CREATE TABLE a (x);',
      '002_b.sql': 'CREATE TABLE b (x);',
      '002_c.sql': 'CREATE TABLE c (x);',
    });
    expect(() => loadMigrations(dir)).toThrow(/contiguous/);
  });
});

describe('migrate', () => {
  it('applies every migration and records the version', () => {
    const db = openDatabase({ file: IN_MEMORY });
    expect(currentVersion(db)).toBe(0);

    const applied = migrate(db);

    expect(applied).toEqual(loadMigrations().map((m) => m.version));
    expect(currentVersion(db)).toBe(loadMigrations().length);
    db.close();
  });

  it('is a no-op the second time', () => {
    const db = openDatabase({ file: IN_MEMORY });
    migrate(db);
    expect(migrate(db)).toEqual([]);
    db.close();
  });

  it('creates every table the application expects', () => {
    const db = openDatabase({ file: IN_MEMORY });
    migrate(db);
    expect(tableNames(db)).toEqual([
      'bookmarks',
      'coach_messages',
      'coach_sessions',
      'drafts',
      'events',
      'notes',
      'problem_progress',
      'settings',
      'submissions',
    ]);
    db.close();
  });

  it('applies only the migrations newer than the recorded version', () => {
    const dir = migrationDir({
      '001_a.sql': 'CREATE TABLE a (x);',
      '002_b.sql': 'CREATE TABLE b (x);',
    });
    const db = openDatabase({ file: IN_MEMORY });

    db.exec('CREATE TABLE a (x); PRAGMA user_version = 1');
    expect(migrate(db, dir)).toEqual([2]);
    db.close();
  });

  it('leaves the version untouched when a migration fails', () => {
    const dir = migrationDir({
      '001_a.sql': 'CREATE TABLE a (x);',
      '002_broken.sql': 'CREATE TABLE b (x); THIS IS NOT SQL;',
    });
    const db = openDatabase({ file: IN_MEMORY });

    expect(() => migrate(db, dir)).toThrow();
    // 001 committed; 002 rolled back whole, table b included.
    expect(currentVersion(db)).toBe(1);
    expect(tableNames(db)).toEqual(['a']);
    db.close();
  });

  it('refuses a database written by a newer build', () => {
    const db = openDatabase({ file: IN_MEMORY });
    db.exec('PRAGMA user_version = 99');
    expect(() => migrate(db)).toThrow(/newer build/);
    db.close();
  });
});

describe('openDatabase', () => {
  it('creates the file and its parent directory', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'devpromax-db-'));
    temps.push(dir);
    const file = path.join(dir, 'nested', 'devpromax.db');

    const db = openDatabase({ file });
    migrate(db);
    db.close();

    expect(fs.existsSync(file)).toBe(true);
  });

  it('enforces foreign keys, without which the coach cascade is a no-op', () => {
    const db = openDatabase({ file: IN_MEMORY });
    const row = db.prepare('PRAGMA foreign_keys').get() as { foreign_keys: number };
    expect(row.foreign_keys).toBe(1);
    db.close();
  });
});

describe('migrations directory', () => {
  it('lives where the build copies it', () => {
    expect(fs.existsSync(path.join(MIGRATIONS_DIR, '001_initial.sql')).valueOf()).toBe(true);
  });
});
