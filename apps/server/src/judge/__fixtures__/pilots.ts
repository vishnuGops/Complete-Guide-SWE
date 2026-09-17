import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  problemMetaSchema,
  testsFileSchema,
  type Language,
  type ProblemMeta,
} from '@devpromax/shared';
import { paths } from '../../config.js';
import type { JudgeTest } from '../index.js';

/**
 * Loads the real pilot problems from `problems/` for the judge integration
 * tests.
 *
 * They are deliberately the same packages the app ships rather than fixtures
 * invented for the tests: if the judge and the catalogue ever disagree about the
 * format, that is exactly the bug these tests exist to catch.
 */
export interface Pilot {
  meta: ProblemMeta;
  dir: string;
  tests: JudgeTest[];
  starter(language: Language): string;
  reference(language: Language): string;
}

const SOURCE_FILES: Record<Language, { starter: string; reference: string }> = {
  python: { starter: 'starter.py', reference: 'reference.py' },
  java: { starter: 'starter.java', reference: 'reference.java' },
};

export function loadPilot(topic: string, slug: string, hiddenLimit = 4): Pilot {
  const dir = path.join(paths.problems, topic, slug);
  const meta = problemMetaSchema.parse(
    JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8')),
  );
  const tests = testsFileSchema.parse(
    JSON.parse(fs.readFileSync(path.join(dir, 'tests.json'), 'utf8')),
  );

  return {
    meta,
    dir,
    tests: [
      ...tests.samples.map((test) => ({ source: 'sample' as const, test })),
      // A handful of hidden tests is enough to exercise the reveal policy
      // without making every integration test pay for the 2000-op case.
      ...tests.hidden.slice(0, hiddenLimit).map((test) => ({ source: 'hidden' as const, test })),
    ],
    starter: (language) => fs.readFileSync(path.join(dir, SOURCE_FILES[language].starter), 'utf8'),
    reference: (language) =>
      fs.readFileSync(path.join(dir, SOURCE_FILES[language].reference), 'utf8'),
  };
}

export const PILOTS = {
  pairSum: () => loadPilot('arrays', 'pair-sum-index'),
  shiftRight: () => loadPilot('arrays', 'shift-right-in-place'),
  minStack: () => loadPilot('stack', 'min-value-stack'),
} as const;

/** A synthetic problem for cases the catalogue has no reason to contain. */
export function syntheticMeta(overrides: Partial<Record<string, unknown>> = {}): ProblemMeta {
  return problemMetaSchema.parse({
    id: 'judge-fixture',
    slug: 'judge-fixture',
    title: 'Judge Fixture',
    version: 1,
    topic: 'arrays',
    patterns: ['fixture'],
    tier: 'Easy',
    rating: 1,
    order: 0,
    mode: 'function',
    entry: 'solve',
    expect: 'return',
    ...overrides,
  });
}

/** Disposable workspace root, so a judge test never writes into `data/`. */
export function makeWorkspaceRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'devpromax-judge-'));
}
