#!/usr/bin/env node
/**
 * Starts every e2e run on an empty database (ROADMAP P8-6).
 *
 * Run by `playwright.config.ts` as the first half of the API's `webServer`
 * command, so it happens before anything has the file open. Not a
 * `globalSetup`: Playwright starts the web servers *before* global setup, and by
 * then the API holds the database - Windows refuses to delete an open file, and
 * Linux deletes it from under a server that goes on writing to the old one.
 *
 * Without it `data/e2e.db` accumulated every run there had ever been, so what a
 * spec met locally depended on every run before it, while CI always starts
 * empty. Now both start empty.
 *
 * Deletes nothing but a file named `e2e.db` and its SQLite companions. The path
 * comes from `DEVPROMAX_DB`, which the config sets, and a path that names any
 * other file is refused: this script is the one place the suite deletes a
 * database, and the owner's is one environment variable away.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const target = process.env['DEVPROMAX_DB'];

if (target === undefined || path.basename(target) !== 'e2e.db') {
  console.error(
    `reset-db: refusing to delete ${String(target)}; the e2e suite only ever resets a file named e2e.db`,
  );
  process.exit(1);
}

for (const suffix of ['', '-wal', '-shm', '-journal']) {
  const file = `${target}${suffix}`;
  try {
    fs.rmSync(file, { force: true });
  } catch (error) {
    // Almost always EBUSY on Windows: another e2e API is still running on it.
    console.error(`reset-db: could not delete ${file} - is another e2e run still going?`);
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
