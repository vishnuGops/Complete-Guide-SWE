import { LANGUAGES, SOURCE_FILE, type Language, type RunResult } from '@devpromax/shared';
import { checkCompiles, runProblemUnqueued, type JudgeTest } from '../judge/index.js';
import { relFile } from './loader.js';
import type { ProblemPackage, ValidationIssue } from './types.js';

/**
 * The merge gate (ROADMAP D7, P2-7): a problem may not ship unless both
 * reference solutions pass every one of its own tests, in both languages.
 *
 * This is the check that makes the catalogue trustworthy. A statement can be
 * ambiguous and a hint can be weak without anyone noticing for months, but a
 * problem that is not solvable as specified is caught here the first time CI
 * runs.
 */

export interface ReferenceCheckOptions {
  workspaceRoot?: string;
  timeoutMultiplier?: number;
  /** Narrow to one language, for a faster inner loop while authoring. */
  languages?: readonly Language[];
  onProgress?: (message: string) => void;
}

function allTests(pkg: ProblemPackage): JudgeTest[] {
  return [
    ...pkg.tests.samples.map((test) => ({ source: 'sample' as const, test })),
    ...pkg.tests.hidden.map((test) => ({ source: 'hidden' as const, test })),
  ];
}

/** Turns a failing run into issues an author can act on without re-running by hand. */
function issuesFromRun(
  pkg: ProblemPackage,
  language: Language,
  result: RunResult,
): ValidationIssue[] {
  const file = relFile(pkg.location, SOURCE_FILE[language].reference);
  if (result.verdict === 'AC') return [];

  if (result.verdict === 'CE') {
    return result.compileErrors.map((err) => ({
      file,
      ...(err.line !== undefined ? { jsonPath: `line ${err.line}` } : {}),
      message: `reference does not compile: ${err.message}`,
      severity: 'error' as const,
    }));
  }

  const samples = pkg.tests.samples.length;
  const failures = result.tests.filter((t) => t.verdict !== 'AC').slice(0, 3);

  return failures.map((test) => {
    const pool = test.index < samples ? 'samples' : 'hidden';
    const indexInPool = test.index < samples ? test.index : test.index - samples;
    const detail = test.message ? ` — ${test.message}` : '';
    return {
      file,
      jsonPath: `${pool}[${indexInPool}]`,
      message: `reference does not pass its own test (${test.verdict})${detail}`,
      severity: 'error' as const,
    };
  });
}

export async function checkReferences(
  pkg: ProblemPackage,
  options: ReferenceCheckOptions = {},
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  const tests = allTests(pkg);
  const languages = options.languages ?? LANGUAGES;

  for (const language of languages) {
    options.onProgress?.(`${pkg.meta.slug}: ${language} starter`);

    // The starter is not expected to be correct, only to be a legal program: a
    // starter that does not compile makes someone's first Run a compile error
    // that tells them nothing about the problem.
    const starter = language === 'python' ? pkg.sources.starterPython : pkg.sources.starterJava;
    const compiled = await checkCompiles(language, starter, {
      ...(options.workspaceRoot !== undefined ? { workspaceRoot: options.workspaceRoot } : {}),
      ...(options.timeoutMultiplier !== undefined
        ? { timeoutMultiplier: options.timeoutMultiplier }
        : {}),
    });
    if (!compiled.ok) {
      const file = relFile(pkg.location, SOURCE_FILE[language].starter);
      for (const err of compiled.errors) {
        issues.push({
          file,
          ...(err.line !== undefined ? { jsonPath: `line ${err.line}` } : {}),
          message: `starter must be a compilable program: ${err.message}`,
          severity: 'error',
        });
      }
    }

    options.onProgress?.(`${pkg.meta.slug}: ${language} reference (${tests.length} tests)`);

    const reference =
      language === 'python' ? pkg.sources.referencePython : pkg.sources.referenceJava;
    const result = await runProblemUnqueued({
      meta: pkg.meta,
      problemDir: pkg.location.dir,
      language,
      code: reference,
      tests,
      kind: 'submit',
      // The author is debugging their own problem, so nothing is hidden from them.
      revealAll: true,
      ...(options.workspaceRoot !== undefined ? { workspaceRoot: options.workspaceRoot } : {}),
      ...(options.timeoutMultiplier !== undefined
        ? { timeoutMultiplier: options.timeoutMultiplier }
        : {}),
    });

    issues.push(...issuesFromRun(pkg, language, result));
  }

  return issues;
}
