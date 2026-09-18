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
/** Both pools, as `tests.json` holds them (ROADMAP P2-14's `loadTests`). */
export type ProblemTests = TestsFile;

export interface ProblemPackage {
  location: ProblemLocation;
  meta: ProblemMeta;
  /**
   * Both pools.
   *
   * Held on the package because the validator and the judge both want them, and
   * *not* held by the catalogue's cache: `createCatalogue` serves packages read
   * with `hidden: false`, and the judge calls `loadTests` when it actually
   * needs the hidden cases (P2-14). A package therefore carries `hidden: []`
   * unless whoever loaded it asked for more, which `hiddenCount` makes visible
   * rather than silent.
   */
  tests: TestsFile;
  /** How many hidden tests exist, whether or not they were loaded. */
  hiddenCount: number;
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
