import { settingsSchema, type Settings, type SettingsUpdate } from '@devpromax/shared';
import { transaction, type Database } from '../open.js';
import { text, type Row } from './rows.js';

/** One row per top-level section of `Settings`. */
const SETTINGS_KEYS = [
  'coach',
  'editor',
  'judge',
  'theme',
  'lastLanguage',
  'welcomeDismissed',
] as const;
type SettingsKey = (typeof SETTINGS_KEYS)[number];

/**
 * Settings storage.
 *
 * The coach API key is stored here in the clear. That is a deliberate,
 * documented limit (docs/ARCHITECTURE.md section 2.3): the database sits in the
 * user's own home directory on a machine they control, and encrypting it with a
 * key stored beside it would be theatre. What the rest of the system must
 * guarantee instead is that the raw key never leaves this layer - the API
 * returns `SettingsView` with `apiKeyMasked`, and nothing logs it.
 */
export interface SettingsRepo {
  /** Always returns a complete object; unset sections come back as their defaults. */
  get(): Settings;
  /** Merges a partial update into the stored settings and returns the result. */
  update(patch: SettingsUpdate): Settings;
}

export function createSettingsRepo(db: Database): SettingsRepo {
  const allStmt = db.prepare('SELECT key, value FROM settings');
  const setStmt = db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
  );

  function read(): Settings {
    const stored: Record<string, unknown> = {};
    for (const row of allStmt.all() as Row[]) {
      const key = text(row, 'key');
      if (!(SETTINGS_KEYS as readonly string[]).includes(key)) continue;
      try {
        stored[key] = JSON.parse(text(row, 'value'));
      } catch {
        // An unreadable row falls back to that section's defaults instead of
        // throwing. The only way a user can repair their settings is the
        // settings screen, so settings must never be what stops the app opening.
      }
    }
    // Parsing rather than casting: this also fills in sections that have never
    // been written, which is every section on a first run.
    const parsed = settingsSchema.safeParse(stored);
    return parsed.success ? parsed.data : settingsSchema.parse({});
  }

  return {
    get: read,

    update(patch) {
      return transaction(db, () => {
        const current = read();
        const merged: Settings = {
          ...current,
          ...(patch.coach ? { coach: { ...current.coach, ...patch.coach } } : {}),
          ...(patch.editor ? { editor: { ...current.editor, ...patch.editor } } : {}),
          ...(patch.judge ? { judge: { ...current.judge, ...patch.judge } } : {}),
          ...(patch.theme !== undefined ? { theme: patch.theme } : {}),
          ...(patch.lastLanguage !== undefined ? { lastLanguage: patch.lastLanguage } : {}),
          ...(patch.welcomeDismissed !== undefined
            ? { welcomeDismissed: patch.welcomeDismissed }
            : {}),
        };
        const next = settingsSchema.parse(merged);

        for (const key of SETTINGS_KEYS) {
          if (patch[key] === undefined) continue;
          setStmt.run(key, JSON.stringify(next[key satisfies SettingsKey]));
        }
        return next;
      });
    },
  };
}
