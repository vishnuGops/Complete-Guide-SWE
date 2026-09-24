import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  json,
  makeCatalogue,
  makeTests,
  VALID_META,
  writeProblem,
} from './__fixtures__/factory.js';
import {
  clearLoaderCaches,
  discoverProblemsCached,
  loadProblemBySlug,
  locateProblem,
} from './loader.js';

/**
 * The loader's memory (ROADMAP P3-9).
 *
 * Two caches, and each has to be wrong in the safe direction: a listing or a
 * package that might be stale is read again rather than served. Most of these
 * tests write files and read them back within a millisecond or two, which is
 * exactly the window where an mtime cannot be trusted - so they are also the
 * tests of the racily-clean rule.
 */

const roots: string[] = [];

function root(): string {
  const made = makeCatalogue();
  roots.push(made);
  return made;
}

afterEach(() => {
  clearLoaderCaches();
  while (roots.length > 0) {
    const dir = roots.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

/** Moves every file and directory under `dir` ten seconds into the past. */
function age(dir: string): void {
  const past = new Date(Date.now() - 10_000);
  for (const entry of fs.readdirSync(dir, { withFileTypes: true, recursive: true })) {
    fs.utimesSync(path.join(entry.parentPath, entry.name), past, past);
  }
  fs.utimesSync(dir, past, past);
}

const SECOND = 'shift-right-in-place';
const secondMeta = json({ ...VALID_META, id: SECOND, slug: SECOND, title: 'Shift Right' });

describe('discoverProblemsCached', () => {
  it('sees a problem added straight after the first listing', () => {
    const dir = root();
    writeProblem(dir, {});
    expect(discoverProblemsCached(dir).map((l) => l.slugDir)).toEqual(['pair-sum-index']);

    // Same topic directory, within the same clock tick as the listing: the
    // directory's mtime may not have moved, and the listing must not be
    // trusted for that reason.
    writeProblem(dir, { slug: SECOND, files: { 'meta.json': secondMeta } });
    expect(discoverProblemsCached(dir).map((l) => l.slugDir)).toEqual(['pair-sum-index', SECOND]);
  });

  it('serves the remembered listing while nothing has changed', () => {
    const dir = root();
    writeProblem(dir, {});
    age(dir);

    const first = discoverProblemsCached(dir);
    expect(discoverProblemsCached(dir)).toBe(first);
  });

  it('notices a problem being removed from an old, trusted listing', () => {
    const dir = root();
    writeProblem(dir, {});
    writeProblem(dir, { slug: SECOND, files: { 'meta.json': secondMeta } });
    age(dir);
    expect(discoverProblemsCached(dir)).toHaveLength(2);

    fs.rmSync(path.join(dir, 'arrays', SECOND), { recursive: true });
    expect(discoverProblemsCached(dir).map((l) => l.slugDir)).toEqual(['pair-sum-index']);
  });
});

describe('locateProblem', () => {
  it('finds a problem by slug, and stops finding it once it is gone', () => {
    const dir = root();
    writeProblem(dir, {});
    expect(locateProblem('pair-sum-index', dir)?.topicDir).toBe('arrays');

    fs.rmSync(path.join(dir, 'arrays', 'pair-sum-index'), { recursive: true });
    expect(locateProblem('pair-sum-index', dir)).toBeUndefined();
  });

  it('finds a problem added after the slug map was built', () => {
    const dir = root();
    writeProblem(dir, {});
    age(dir);
    expect(locateProblem(SECOND, dir)).toBeUndefined();

    writeProblem(dir, { slug: SECOND, files: { 'meta.json': secondMeta } });
    expect(locateProblem(SECOND, dir)?.slugDir).toBe(SECOND);
  });
});

describe('loadProblemBySlug', () => {
  it('parses the hidden tests once for repeated submits of an unchanged problem', () => {
    const dir = root();
    writeProblem(dir, {});
    age(dir);

    const first = loadProblemBySlug('pair-sum-index', dir);
    expect(first?.tests.hidden).toHaveLength(10);
    // The same object: nothing was read or validated the second time.
    expect(loadProblemBySlug('pair-sum-index', dir)).toBe(first);
  });

  it('reads regenerated tests rather than serving the old ones', () => {
    const dir = root();
    writeProblem(dir, {});
    age(dir);
    const first = loadProblemBySlug('pair-sum-index', dir);

    fs.writeFileSync(
      path.join(dir, 'arrays', 'pair-sum-index', 'tests.json'),
      json(makeTests(3, 12)),
      'utf8',
    );
    const second = loadProblemBySlug('pair-sum-index', dir);
    expect(second).not.toBe(first);
    expect(second?.tests.hidden).toHaveLength(12);
  });

  it('does not trust a package read in the same instant its files were written', () => {
    const dir = root();
    const problem = writeProblem(dir, {});
    // "Just written", held still: a loaded machine can take longer than the
    // racy window between a write and the read after it.
    const now = new Date(Date.now() + 1000);
    fs.utimesSync(path.join(problem, 'tests.json'), now, now);

    const first = loadProblemBySlug('pair-sum-index', dir);
    // Too fresh to be sure of: read again rather than risk a stale answer.
    expect(loadProblemBySlug('pair-sum-index', dir)).not.toBe(first);
  });

  it('keeps samples-only and full loads apart', () => {
    const dir = root();
    writeProblem(dir, {});
    age(dir);

    const samples = loadProblemBySlug('pair-sum-index', dir, { hidden: false });
    const full = loadProblemBySlug('pair-sum-index', dir);
    expect(samples?.tests.hidden).toEqual([]);
    expect(samples?.hiddenCount).toBe(10);
    expect(full?.tests.hidden).toHaveLength(10);
  });
});
