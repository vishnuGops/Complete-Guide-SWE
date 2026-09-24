import { z } from 'zod';
import { languageSchema } from './language.js';
import { coachProviderSchema } from './coach.js';

/** `system` follows the OS; the other two override it (ROADMAP P0-8). */
export const THEMES = ['light', 'dark', 'system'] as const;
export const themeSchema = z.enum(THEMES);
export type Theme = z.infer<typeof themeSchema>;

export const editorPrefsSchema = z.object({
  fontSize: z.int().min(10).max(24).default(14),
  tabSize: z.int().min(2).max(8).default(4),
  vimKeybindings: z.boolean().default(false),
  wordWrap: z.boolean().default(false),
  /**
   * Run the language's formatter when the user saves with Ctrl+S (ROADMAP
   * P9-5). Off by default: the formatter is optional, and rewriting someone's
   * layout is something they should have asked for.
   */
  formatOnSave: z.boolean().default(false),
});
export type EditorPrefs = z.infer<typeof editorPrefsSchema>;

export const judgePrefsSchema = z.object({
  /** Multiplier applied on top of each problem's limits, for slower machines. */
  timeoutMultiplier: z.number().min(0.5).max(5).default(1),
  /** Concurrent judge runs (ROADMAP P2-1 default 2). */
  concurrency: z.int().min(1).max(8).default(2),
});
export type JudgePrefs = z.infer<typeof judgePrefsSchema>;

export const coachSettingsSchema = z.object({
  provider: coachProviderSchema.default('anthropic'),
  model: z.string().min(1).nullable().default(null),
  /**
   * Stored in the local DB only. Never logged, never returned by the API, never
   * included in an export (CLAUDE.md > Secrets) - the read path returns
   * `SettingsView` with `apiKeyMasked` instead.
   */
  apiKey: z.string().nullable().default(null),
  /** Session spend ceiling in USD; null disables the cap (P5-6). */
  spendCapUsd: z.number().min(0).nullable().default(null),
  /**
   * Where an OpenAI-compatible endpoint lives (ROADMAP P9-4).
   *
   * A setting rather than an environment variable, because for that provider
   * the address *is* the configuration - it is how "the coach" becomes "the
   * model on this laptop". Ignored by the other two, whose address is a fact
   * about the vendor. Null falls back to Ollama's default port.
   */
  baseUrl: z.string().url().nullable().default(null),
});
export type CoachSettings = z.infer<typeof coachSettingsSchema>;

export const settingsSchema = z.object({
  coach: coachSettingsSchema.prefault({}),
  editor: editorPrefsSchema.prefault({}),
  judge: judgePrefsSchema.prefault({}),
  theme: themeSchema.default('system'),
  lastLanguage: languageSchema.default('python'),
  /**
   * Whether the first-run welcome has been dismissed (ROADMAP P8-3).
   *
   * A setting rather than something in the browser: the welcome explains Run,
   * Submit and AI Help, and someone who has read it once has read it - clearing
   * site data or opening the app in another browser should not start the tour
   * again.
   */
  welcomeDismissed: z.boolean().default(false),
});
export type Settings = z.infer<typeof settingsSchema>;

/** Every field of `S` optional, with its `.default()` taken off. */
type PatchShape<S extends z.ZodRawShape> = {
  [K in keyof S]: z.ZodOptional<S[K] extends z.ZodDefault<infer Inner> ? Inner : S[K]>;
};

/**
 * The patch form of a settings section: every field optional and none
 * defaulted.
 *
 * Not `.partial()`. In zod 4 a `.default()` still fires inside `.partial()`, so
 * `{ coach: { model: 'm' } }` parsed as `{ coach: { model: 'm', provider:
 * 'anthropic', apiKey: null, ... } }` and a one-field PUT reset every sibling in
 * the section - the stored API key included (ROADMAP P3-7). A patch has to
 * carry exactly what the client sent, because the settings service reads
 * `'apiKey' in patch.coach` as "the user touched the key".
 */
function patchOf<S extends z.ZodRawShape>(section: z.ZodObject<S>): z.ZodObject<PatchShape<S>> {
  const shape: Record<string, z.ZodType> = {};
  for (const [key, field] of Object.entries(section.shape)) {
    // Every settings field is a classic schema; the shape's type is the core one.
    const inner = (field instanceof z.ZodDefault ? field.unwrap() : field) as z.ZodType;
    shape[key] = inner.optional();
  }
  // The loop builds exactly `PatchShape<S>`; TypeScript cannot follow a mapped
  // type through Object.entries.
  return z.object(shape) as unknown as z.ZodObject<PatchShape<S>>;
}

/** Partial update accepted by `PUT /api/settings`. */
export const settingsUpdateSchema = z.object({
  coach: patchOf(coachSettingsSchema).optional(),
  editor: patchOf(editorPrefsSchema).optional(),
  judge: patchOf(judgePrefsSchema).optional(),
  theme: themeSchema.optional(),
  lastLanguage: languageSchema.optional(),
  welcomeDismissed: z.boolean().optional(),
});
export type SettingsUpdate = z.infer<typeof settingsUpdateSchema>;

/** What the API is allowed to send to the UI: the key is replaced by a mask. */
export const settingsViewSchema = settingsSchema.extend({
  coach: coachSettingsSchema.omit({ apiKey: true }).extend({
    apiKeyMasked: z.string().nullable(),
    apiKeySource: z.enum(['none', 'settings', 'env']),
  }),
});
export type SettingsView = z.infer<typeof settingsViewSchema>;

/**
 * Shows only the last four characters, and only when the key is long enough that
 * those four are not most of it.
 */
export function maskApiKey(key: string | null | undefined): string | null {
  if (!key) return null;
  const trimmed = key.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length <= 8) return '••••••••';
  return `${'•'.repeat(8)}${trimmed.slice(-4)}`;
}

/** Env override, checked before the stored key (ROADMAP P3-4). */
export const COACH_API_KEY_ENV = 'COACH_API_KEY';
