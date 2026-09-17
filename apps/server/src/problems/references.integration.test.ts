import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { paths } from '../config.js';
import { discoverProblems, loadProblem } from './loader.js';
import { checkReferences } from './references.js';
import { validateCatalogueFull } from './validate.js';
import type { ProblemPackage } from './types.js';

/**
 * The merge gate, tested against the real catalogue and against deliberately
 * broken copies of it. Spawns real interpreters.
 */

let workspaceRoot: string;
const scratch: string[] = [];

beforeAll(() => {
  workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'devpromax-refs-'));
});

afterAll(() => {
  fs.rmSync(workspaceRoot, { recursive: true, force: true });
});

afterEach(() => {
  while (scratch.length > 0) {
    const dir = scratch.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

function pilotPackage(slug: string): ProblemPackage {
  const location = discoverProblems(paths.problems).find((l) => l.slugDir === slug);
  expect(location, `${slug} is missing from the catalogue`).toBeDefined();
  const { pkg, issues } = loadProblem(location!);
  expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
  return pkg!;
}

/** A copy of a real problem with one file replaced, so the gate has something to catch. */
function brokenCopy(slug: string, file: string, contents: string): ProblemPackage {
  const original = discoverProblems(paths.problems).find((l) => l.slugDir === slug)!;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'devpromax-broken-'));
  scratch.push(root);
  const dir = path.join(root, original.topicDir, original.slugDir);
  fs.mkdirSync(dir, { recursive: true });
  fs.cpSync(original.dir, dir, { recursive: true });
  fs.writeFileSync(path.join(dir, file), contents, 'utf8');

  const { pkg } = loadProblem({
    ...original,
    dir,
    relDir: `problems/${original.topicDir}/${original.slugDir}`,
  });
  return pkg!;
}

describe('checkReferences', () => {
  it('passes every pilot problem in both languages', async () => {
    for (const slug of ['pair-sum-index', 'shift-right-in-place', 'min-value-stack']) {
      const issues = await checkReferences(pilotPackage(slug), { workspaceRoot });
      expect(issues, `${slug} failed its own tests`).toEqual([]);
    }
  }, 120_000);

  it('catches a Python reference that gets its own tests wrong', async () => {
    const pkg = brokenCopy(
      'pair-sum-index',
      'reference.py',
      'from typing import List\n\n\nclass Solution:\n    def pairSumIndex(self, values: List[int], target: int) -> List[int]:\n        return [0, 0]\n',
    );

    const issues = await checkReferences(pkg, { workspaceRoot, languages: ['python'] });
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]?.file).toContain('reference.py');
    expect(issues[0]?.message).toMatch(/does not pass its own test \(WA\)/);
    expect(issues[0]?.jsonPath).toMatch(/^samples\[\d+\]$/);
  }, 60_000);

  it('catches a Java reference that does not compile', async () => {
    const pkg = brokenCopy(
      'pair-sum-index',
      'reference.java',
      'import java.util.*;\n\nclass Solution {\n    public int[] pairSumIndex(int[] values, int target) {\n        return notAThing;\n    }\n}\n',
    );

    const issues = await checkReferences(pkg, { workspaceRoot, languages: ['java'] });
    expect(issues.some((i) => i.message.includes('reference does not compile'))).toBe(true);
  }, 60_000);

  it('catches a starter that is not a compilable program', async () => {
    const pkg = brokenCopy(
      'pair-sum-index',
      'starter.java',
      'import java.util.*;\n\nclass Solution {\n    public int[] pairSumIndex(int[] values, int target) {\n    }\n}\n',
    );

    const issues = await checkReferences(pkg, { workspaceRoot, languages: ['java'] });
    expect(issues.some((i) => i.message.includes('starter must be a compilable program'))).toBe(
      true,
    );
    expect(issues.some((i) => i.file.includes('starter.java'))).toBe(true);
  }, 60_000);

  it('names the hidden test that fails, not just the count', async () => {
    const pkg = brokenCopy(
      'shift-right-in-place',
      'reference.py',
      // Correct only when the shift is already reduced; the hidden tests that
      // use a shift larger than the row will fail.
      'from typing import List\n\n\nclass Solution:\n    def shiftRight(self, values: List[int], shift: int) -> None:\n        n = len(values)\n        if n == 0 or shift == 0:\n            return\n        copy = values[:]\n        for i in range(n):\n            values[(i + shift) % n] = copy[i]\n        if shift >= n:\n            values[0] = 999\n',
    );

    const issues = await checkReferences(pkg, { workspaceRoot, languages: ['python'] });
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.every((i) => /^(samples|hidden)\[\d+\]$/.test(i.jsonPath ?? ''))).toBe(true);
  }, 60_000);

  it('limits itself to the first few failures so the report stays readable', async () => {
    const pkg = brokenCopy(
      'pair-sum-index',
      'reference.py',
      'from typing import List\n\n\nclass Solution:\n    def pairSumIndex(self, values: List[int], target: int) -> List[int]:\n        return []\n',
    );

    const issues = await checkReferences(pkg, { workspaceRoot, languages: ['python'] });
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.length).toBeLessThanOrEqual(3);
  }, 60_000);
});

describe('validateCatalogueFull', () => {
  it('passes the shipped catalogue', async () => {
    const report = await validateCatalogueFull({ workspaceRoot });
    expect(report.ok).toBe(true);
    expect(report.errorCount).toBe(0);
  }, 180_000);

  it('skips reference execution for a problem that is already statically broken', async () => {
    // Spawning six interpreters to confirm that a package missing its tests.json
    // does not work would only bury the message that actually matters.
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'devpromax-partial-'));
    scratch.push(root);
    const dir = path.join(root, 'arrays', 'pair-sum-index');
    fs.mkdirSync(dir, { recursive: true });
    fs.cpSync(path.join(paths.problems, 'arrays', 'pair-sum-index'), dir, { recursive: true });
    fs.rmSync(path.join(dir, 'tests.json'));

    const started = Date.now();
    const report = await validateCatalogueFull({ root, workspaceRoot });
    expect(report.ok).toBe(false);
    expect(Date.now() - started).toBeLessThan(3000);
  }, 30_000);
});
