import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transaction, type Database } from './open.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** src/db/migrations, and the same layout under dist/ (see scripts/copy-assets.mjs). */
export const MIGRATIONS_DIR = path.resolve(HERE, 'migrations');

const FILE_PATTERN = /^(\d{3})_([a-z0-9_]+)\.sql$/;

export interface Migration {
  version: number;
  name: string;
  file: string;
  sql: string;
}

/**
 * Reads the checked-in migrations in version order.
 *
 * Versions must start at 1 and have no gaps or duplicates. That rule exists to
 * catch the one mistake this scheme is prone to: two branches each adding an
 * `002_`, which would otherwise mean whichever merged second never runs on a
 * database that already recorded version 2.
 */
export function loadMigrations(dir: string = MIGRATIONS_DIR): Migration[] {
  const entries = fs.readdirSync(dir).filter((name) => name.endsWith('.sql'));

  const migrations = entries.map((file) => {
    const match = FILE_PATTERN.exec(file);
    if (!match?.[1] || !match[2]) {
      throw new Error(
        `Migration "${file}" must be named NNN_snake_case.sql (e.g. 002_add_notes.sql).`,
      );
    }
    return {
      version: Number(match[1]),
      name: match[2],
      file,
      sql: fs.readFileSync(path.join(dir, file), 'utf8'),
    };
  });

  migrations.sort((a, b) => a.version - b.version);

  migrations.forEach((migration, index) => {
    const expected = index + 1;
    if (migration.version !== expected) {
      throw new Error(
        `Migration versions must be contiguous from 001: expected ${String(expected).padStart(3, '0')}, found "${migration.file}".`,
      );
    }
  });

  return migrations;
}

/** The schema version recorded in the database file itself. */
export function currentVersion(db: Database): number {
  const row = db.prepare('PRAGMA user_version').get() as { user_version?: number } | undefined;
  return Number(row?.user_version ?? 0);
}

/**
 * Applies every migration newer than the database's recorded version, each in
 * its own transaction together with the version bump - so an interrupted
 * migration leaves the database at the last version that fully applied, never
 * half-way through one.
 *
 * Returns the versions applied, which is empty on an already-current database.
 */
export function migrate(db: Database, dir: string = MIGRATIONS_DIR): number[] {
  const migrations = loadMigrations(dir);
  const from = currentVersion(db);

  if (from > migrations.length) {
    throw new Error(
      `Database is at schema version ${from} but only ${migrations.length} migration(s) exist. ` +
        'This database was written by a newer build of DevProMax; downgrading is not supported.',
    );
  }

  const applied: number[] = [];
  for (const migration of migrations) {
    if (migration.version <= from) continue;
    // PRAGMA user_version is transactional in SQLite, so the schema change and
    // the bookkeeping commit or fail together - a migration that throws part way
    // through leaves the database on the version before it, never between two.
    transaction(db, () => {
      db.exec(migration.sql);
      db.exec(`PRAGMA user_version = ${migration.version}`);
    });
    applied.push(migration.version);
  }

  return applied;
}
