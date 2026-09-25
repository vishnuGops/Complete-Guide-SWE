import fs from 'node:fs';
import path from 'node:path';

/**
 * What goes into the bundle and what must never (ROADMAP P10-4), apart from
 * the script that builds it so each rule has a test of its own.
 */

/** Files the problem loader reads (`problems/loader.ts`), plus the checker the judge imports. */
const PROBLEM_FILES = new Set([
  'meta.json',
  'statement.md',
  'tests.json',
  'hints.json',
  'editorial.md',
  'starter.py',
  'starter.java',
  'reference.py',
  'reference.java',
  'checker.ts',
]);

/**
 * Whether a file under `problems/` ships: what the loader reads, and a
 * statement's images. `generator.py`, bytecode and the generator's version
 * stamp are authoring tools and stay behind.
 */
export function shipsProblemFile(file: string): boolean {
  if (file.split(/[\\/]/).includes('assets')) return true;
  return PROBLEM_FILES.has(path.basename(file));
}

/** Build output that is for a developer rather than for the app. */
export function shipsBuildFile(file: string): boolean {
  return (
    !file.endsWith('.map') && !file.endsWith('.d.ts') && !/[\\/]cli[\\/]package\.js$/.test(file)
  );
}

const TEST_FILE = /\.test\.[cm]?[jt]sx?$/;

/**
 * Dependencies ship without their own tests: zod publishes its source, test
 * suite included, and 856 test files are not something an installer should
 * carry - or something the refusal below should have to make an exception for.
 */
export function shipsDependencyFile(file: string): boolean {
  return !TEST_FILE.test(path.basename(file));
}

/**
 * Everything in `root` that must not ship, each with the reason: a symlink (an
 * installer does not carry them), a practice `data/` folder, a native module
 * (D14 - it would tie the bundle to one Node ABI), an environment file, a test.
 */
export function bundleRefusals(root: string): string[] {
  const refused: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const relative = path.relative(root, full);
      if (entry.isSymbolicLink()) refused.push(`${relative} (a symlink)`);
      else if (entry.isDirectory()) {
        if (entry.name === 'data' && dir === root) refused.push(`${relative} (practice data)`);
        else walk(full);
      } else if (entry.name.endsWith('.node')) {
        refused.push(`${relative} (a native module)`);
      } else if (entry.name === '.env' || entry.name.startsWith('.env.')) {
        refused.push(`${relative} (an environment file)`);
      } else if (TEST_FILE.test(entry.name)) {
        refused.push(`${relative} (a test)`);
      }
    }
  };
  walk(root);
  return refused;
}
