import { migrate } from './migrate.js';
import { openDatabase, type Database, type OpenOptions } from './open.js';
import { createCoachRepo, type CoachRepo } from './repos/coach.js';
import { createDraftRepo, type DraftRepo } from './repos/drafts.js';
import { createEventRepo, type EventRepo } from './repos/events.js';
import { createBookmarkRepo, type BookmarkRepo } from './repos/bookmarks.js';
import { createNoteRepo, type NoteRepo } from './repos/notes.js';
import { createProgressRepo, type ProgressRepo } from './repos/progress.js';
import { createSettingsRepo, type SettingsRepo } from './repos/settings.js';
import { createSubmissionRepo, type SubmissionRepo } from './repos/submissions.js';

export { IN_MEMORY, openDatabase, transaction, nowIso } from './open.js';
export type { Database, OpenOptions } from './open.js';
export { migrate, currentVersion, loadMigrations, MIGRATIONS_DIR } from './migrate.js';
export type { Migration } from './migrate.js';
export * from './repos/coach.js';
export * from './repos/drafts.js';
export * from './repos/events.js';
export * from './repos/bookmarks.js';
export * from './repos/notes.js';
export * from './repos/progress.js';
export * from './repos/settings.js';
export * from './repos/submissions.js';

/**
 * The one handle the rest of the server holds. Routes take this rather than a
 * raw `Database`, which is what keeps SQL inside this folder: a route that wants
 * a new query has to add it to a repository, where it can be unit-tested against
 * an in-memory database without a server.
 */
export interface Repositories {
  db: Database;
  submissions: SubmissionRepo;
  drafts: DraftRepo;
  progress: ProgressRepo;
  notes: NoteRepo;
  bookmarks: BookmarkRepo;
  settings: SettingsRepo;
  coach: CoachRepo;
  events: EventRepo;
  close(): void;
}

export function createRepositories(db: Database): Repositories {
  return {
    db,
    submissions: createSubmissionRepo(db),
    drafts: createDraftRepo(db),
    progress: createProgressRepo(db),
    notes: createNoteRepo(db),
    bookmarks: createBookmarkRepo(db),
    settings: createSettingsRepo(db),
    coach: createCoachRepo(db),
    events: createEventRepo(db),
    close: () => {
      db.close();
    },
  };
}

/** Opens the database, applies pending migrations, and wires the repositories. */
export function createDatabase(options: OpenOptions = {}): Repositories {
  const db = openDatabase(options);
  migrate(db);
  return createRepositories(db);
}
