import { z } from 'zod';

export const LANGUAGES = ['python', 'java'] as const;
export const languageSchema = z.enum(LANGUAGES);
export type Language = z.infer<typeof languageSchema>;

/** File name of the starter/reference source for each language, inside a problem dir. */
export const SOURCE_FILE: Record<Language, { starter: string; reference: string }> = {
  python: { starter: 'starter.py', reference: 'reference.py' },
  java: { starter: 'starter.java', reference: 'reference.java' },
};

export const LANGUAGE_LABEL: Record<Language, string> = {
  python: 'Python',
  java: 'Java',
};

/**
 * Minimum runtime versions we support (see CLAUDE.md > Environment). The Java
 * harness is compiled with `--release 21`; the Python harness must not use
 * syntax newer than 3.10.
 */
export const MIN_RUNTIME = {
  python: '3.10',
  java: '21',
} as const satisfies Record<Language, string>;
