import type { HintsFile, ProblemMeta, TestsFile } from '@devpromax/shared';

/** One problem directory on disk, located but not yet read. */
export interface ProblemLocation {
  /** Directory name under `problems/`, which must equal `meta.topic`. */
  topicDir: string;
  /** Directory name of the problem, which must equal `meta.slug`. */
  slugDir: string;
  /** Absolute path to the problem directory. */
  dir: string;
  /** Path relative to the repo root, used in every message. */
  relDir: string;
}

/** A fully parsed problem package. Only produced when the required files parse. */
export interface ProblemPackage {
  location: ProblemLocation;
  meta: ProblemMeta;
  tests: TestsFile;
  hints: HintsFile;
  statement: string;
  editorial: string;
  sources: {
    starterPython: string;
    starterJava: string;
    referencePython: string;
    referenceJava: string;
  };
  /** Present only when the optional file exists. */
  generatorPython?: string;
  hasChecker: boolean;
  /** File names found under `assets/`, empty when the directory is absent. */
  assets: string[];
}

export type IssueSeverity = 'error' | 'warning';

export interface ValidationIssue {
  /** Repo-relative path of the file the issue is about. */
  file: string;
  /** Dotted/indexed path inside that file, when it has one (`samples[2].explanation`). */
  jsonPath?: string;
  message: string;
  severity: IssueSeverity;
}

export interface ProblemValidation {
  location: ProblemLocation;
  /** Undefined when the package could not be parsed far enough to build one. */
  pkg?: ProblemPackage;
  issues: ValidationIssue[];
}

export function hasErrors(issues: readonly ValidationIssue[]): boolean {
  return issues.some((i) => i.severity === 'error');
}
