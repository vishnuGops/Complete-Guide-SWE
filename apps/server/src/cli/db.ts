#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { paths } from '../config.js';
import { backupFilename, backupTo, inspectBackup, restoreFrom } from '../db/backup.js';
import { createDatabase } from '../db/index.js';

/**
 * Backing up and restoring the practice database (ROADMAP P8-3).
 *
 *   npm run db:backup                  # into data/, named by the moment
 *   npm run db:backup -- path/file.db  # somewhere of your choosing
 *   npm run db:restore -- path/file.db
 *
 * A command rather than a button, and deliberately. A backup is a file the user
 * has to be able to put somewhere else - another disk, a synced folder - and a
 * browser can only ever hand it to the downloads directory. Restore is worse:
 * it replaces the live database, which cannot be done from inside the process
 * that has it open. Settings says where the file is and points here.
 */

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const [command, argument] = process.argv.slice(2);

if (command === 'backup') {
  const target = argument ?? path.join(paths.data, backupFilename());
  const repos = createDatabase({ file: paths.db });
  try {
    const result = backupTo(repos.db, target);
    const kb = Math.max(1, Math.round(result.bytes / 1024));
    process.stdout.write(`Backed up to ${result.file} (${String(kb)} KB).\n`);
  } catch (error) {
    fail(`Backup failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    repos.close();
  }
} else if (command === 'restore') {
  if (argument === undefined) fail('Usage: npm run db:restore -- <file>');

  const check = inspectBackup(argument);
  if (!check.ok) fail(`${argument} cannot be restored: ${check.problem ?? 'unknown reason'}.`);

  // Nothing is opened before the move: on Windows an open handle turns a
  // restore into a permission error, and the point of this command is that it
  // is the one safe way to do this.
  if (fs.existsSync(paths.db)) {
    process.stdout.write(
      `Replacing ${paths.db}. The database that is there now will be kept beside it.\n`,
    );
  }

  try {
    const result = restoreFrom(argument, paths.db);
    process.stdout.write(`Restored ${result.from} to ${result.to}.\n`);
    if (fs.existsSync(result.displaced)) {
      process.stdout.write(`The previous database is at ${result.displaced}.\n`);
    }
    // Opened afterwards, so a backup from an older schema is migrated forward
    // before anyone tries to use it.
    const repos = createDatabase({ file: paths.db });
    repos.close();
    process.stdout.write('Schema is up to date. Start the app to use it.\n');
  } catch (error) {
    fail(`Restore failed: ${error instanceof Error ? error.message : String(error)}`);
  }
} else {
  fail(
    [
      'Usage:',
      '  npm run db:backup                  # into data/, named by the moment',
      '  npm run db:backup -- <file>        # somewhere of your choosing',
      '  npm run db:restore -- <file>',
    ].join('\n'),
  );
}
