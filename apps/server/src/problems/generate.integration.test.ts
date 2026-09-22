import fs from 'node:fs';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { makeWorkspaceRoot } from '../judge/__fixtures__/pilots.js';
import { makeCatalogue, writeProblem } from './__fixtures__/factory.js';
import { GenerateError, generateHiddenTests, seedFor, writeHiddenTests } from './generate.js';
import { discoverProblems, loadProblem, loadProblemBySlug } from './loader.js';
import type { ProblemPackage } from './types.js';

/**
 * The generation pipeline, running real interpreters (ROADMAP P2-9).
 *
 * Stubbing python here would test the plumbing and none of the point: the whole
 * value of `problems:gen` is that the answers come from a program that actually
 * ran, and that a second program agrees with them.
 */

let workspaceRoot: string;
let root: string;

beforeAll(() => {
  workspaceRoot = makeWorkspaceRoot();
});

afterAll(() => {
  fs.rmSync(workspaceRoot, { recursive: true, force: true });
});

beforeEach(() => {
  root = makeCatalogue();
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

/** A throwaway copy of the fixture problem, with its generator replaced. */
function withGenerator(source: string, slug = 'pair-sum-index'): ProblemPackage {
  writeProblem(root, { slug, files: { 'generator.py': source } });
  const location = discoverProblems(root).find((l) => l.slugDir === slug);
  const { pkg, issues } = loadProblem(location!);
  expect(issues, 'the fixture problem should parse').toEqual([]);
  return pkg!;
}

const UNIQUE_PAIRS = `
import random
from typing import Any, Dict, Iterator


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield {"args": [[4, 9], 13], "name": "smallest input"}
    yield {"args": [[-8, -3, 5, 11], -11], "name": "negatives"}
    for _ in range(4):
        n = rng.randint(2, 8)
        values = [rng.randint(-40, 40) for _ in range(n)]
        i, j = rng.sample(range(n), 2)
        target = values[i] + values[j]
        pairs = sum(
            1
            for a in range(n)
            for b in range(a + 1, n)
            if values[a] + values[b] == target
        )
        if pairs == 1:
            yield {"args": [values, target]}
`.trim();

describe('running the generator', () => {
  it('answers every case with the reference, never with the generator', async () => {
    const pkg = withGenerator(UNIQUE_PAIRS);

    const result = await generateHiddenTests(pkg, { crossCheck: false, workspaceRoot });

    expect(result.hidden.length).toBeGreaterThan(0);
    for (const test of result.hidden) {
      // The fixture is a two-sum: the answer is a pair of indices, and the
      // generator above never said what it should be.
      expect(Array.isArray(test.expected)).toBe(true);
      expect((test.expected as number[]).length).toBe(2);
    }
  });

  it('is deterministic: the same seed produces byte-identical tests', async () => {
    const pkg = withGenerator(UNIQUE_PAIRS);

    const first = await generateHiddenTests(pkg, { seed: 42, crossCheck: false, workspaceRoot });
    const second = await generateHiddenTests(pkg, { seed: 42, crossCheck: false, workspaceRoot });

    expect(JSON.stringify(second.hidden)).toBe(JSON.stringify(first.hidden));
  });

  it('is deterministic even when the generator iterates a set of strings', async () => {
    // String hashing is randomised per process unless PYTHONHASHSEED is fixed,
    // so without it the order of this set - and therefore every case built from
    // it - changes between two runs with the same seed. Twenty-six words make an
    // accidental match between two random orders vanishingly unlikely.
    const pkg = withGenerator(
      [
        'import random',
        'from typing import Any, Dict, Iterator',
        '',
        '',
        'def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:',
        '    words = list({letter * 3 for letter in "abcdefghijklmnopqrstuvwxyz"})',
        '    for index in range(4):',
        '        values = [len(word) * (index + 1) + i for i, word in enumerate(words[index:index + 3])]',
        '        yield {"args": [values + [ord(words[index][0])], values[0] + values[1]]}',
      ].join('\n'),
    );

    const first = await generateHiddenTests(pkg, { seed: 7, crossCheck: false, workspaceRoot });
    const second = await generateHiddenTests(pkg, { seed: 7, crossCheck: false, workspaceRoot });

    expect(JSON.stringify(second.hidden)).toBe(JSON.stringify(first.hidden));
  });

  it('defaults to a seed derived from the slug, so a rerun changes nothing', async () => {
    const pkg = withGenerator(UNIQUE_PAIRS);
    const result = await generateHiddenTests(pkg, { crossCheck: false, workspaceRoot });
    expect(result.seed).toBe(seedFor(pkg.meta.slug));
  });

  it('drops duplicate inputs rather than judging the same case twice', async () => {
    const pkg = withGenerator(
      [
        'import random',
        'from typing import Any, Dict, Iterator',
        '',
        '',
        'def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:',
        '    for _ in range(5):',
        '        yield {"args": [[4, 9], 13]}',
      ].join('\n'),
    );

    const result = await generateHiddenTests(pkg, { crossCheck: false, workspaceRoot });

    expect(result.generated).toBe(5);
    expect(result.duplicates).toBe(4);
    expect(result.hidden).toHaveLength(1);
  });

  it('refuses a generator that claims to know the answer', async () => {
    const pkg = withGenerator(
      [
        'import random',
        'from typing import Any, Dict, Iterator',
        '',
        '',
        'def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:',
        '    yield {"args": [[4, 9], 13], "expected": [0, 1]}',
      ].join('\n'),
    );

    await expect(generateHiddenTests(pkg, { crossCheck: false, workspaceRoot })).rejects.toThrow(
      GenerateError,
    );
    await expect(generateHiddenTests(pkg, { crossCheck: false, workspaceRoot })).rejects.toThrow(
      /not a usable test case/,
    );
  });

  it('reports a generator that raises, with the traceback', async () => {
    const pkg = withGenerator(
      [
        'import random',
        '',
        '',
        'def generate(rng):',
        '    yield {"args": [[1, 2], 3]}',
        '    raise ValueError("constraints are impossible here")',
      ].join('\n'),
    );

    await expect(generateHiddenTests(pkg, { crossCheck: false, workspaceRoot })).rejects.toThrow(
      /generator.py failed/,
    );
  });

  it('blames the generator when the reference cannot answer a case', async () => {
    // Two-sum with no pair at all: the reference returns [], which is a legal
    // value, so the failure has to surface as the cross-check or as a bad test.
    // Here the reference raises instead, which is the clearer signal.
    const pkg = withGenerator(
      ['import random', '', '', 'def generate(rng):', '    yield {"args": ["not a list", 3]}'].join(
        '\n',
      ),
    );

    await expect(generateHiddenTests(pkg, { crossCheck: false, workspaceRoot })).rejects.toThrow(
      /reference failed on generated case/,
    );
  });
});

describe('the two references have to agree', () => {
  it('fails when the Java reference disagrees with the Python one', async () => {
    const pkg = withGenerator(UNIQUE_PAIRS);

    // Same problem, subtly wrong: returns the indices the other way round. The
    // comparator is `exact`, so order matters and this is a real disagreement.
    const broken: ProblemPackage = {
      ...pkg,
      sources: {
        ...pkg.sources,
        referenceJava: `import java.util.*;

class Solution {
    public int[] pairSumIndex(int[] nums, int target) {
        Map<Integer, Integer> seen = new HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            Integer j = seen.get(target - nums[i]);
            if (j != null) return new int[] { i, j };
            seen.put(nums[i], i);
        }
        return new int[0];
    }
}
`,
      },
    };

    await expect(generateHiddenTests(broken, { workspaceRoot })).rejects.toThrow(/disagree/);
  });

  it('passes when they agree', async () => {
    const pkg = withGenerator(UNIQUE_PAIRS);
    const result = await generateHiddenTests(pkg, { workspaceRoot });
    expect(result.crossChecked).toBe(true);
  });
});

describe('the real pilot problems', () => {
  it('fills expectedMutatedArgs from the reference, for the argument that is mutated', async () => {
    const pkg = loadProblemBySlug('shift-right-in-place');
    expect(pkg).toBeDefined();

    const result = await generateHiddenTests(pkg!, {
      crossCheck: false,
      limit: 6,
      workspaceRoot,
    });

    for (const test of result.hidden) {
      expect(test.expectedMutatedArgs).toBeDefined();
      // The array is argument 0; the shift count is a scalar and cannot be
      // mutated in place, so recording it would be noise.
      expect(test.expectedMutatedArgs?.map((arg) => arg.index)).toEqual([0]);
      expect(test.expected).toBeUndefined();
    }
  });

  it('fills one expected entry per op for an operations problem', async () => {
    const pkg = loadProblemBySlug('min-value-stack');
    expect(pkg).toBeDefined();

    const result = await generateHiddenTests(pkg!, {
      crossCheck: false,
      limit: 6,
      workspaceRoot,
    });

    for (const test of result.hidden) {
      expect(Array.isArray(test.expected)).toBe(true);
      expect((test.expected as unknown[]).length).toBe(test.ops?.length);
    }
  });
});

describe('writing the result back', () => {
  it('keeps the samples and replaces only the hidden tests', async () => {
    const pkg = withGenerator(UNIQUE_PAIRS);
    const samplesBefore = JSON.stringify(pkg.tests.samples);

    const result = await generateHiddenTests(pkg, { crossCheck: false, workspaceRoot });
    writeHiddenTests(pkg, result.hidden);

    const written = JSON.parse(
      fs.readFileSync(path.join(pkg.location.dir, 'tests.json'), 'utf8'),
    ) as { samples: unknown[]; hidden: unknown[] };

    expect(JSON.stringify(written.samples)).toBe(samplesBefore);
    expect(written.hidden).toHaveLength(result.hidden.length);
  });

  it('bumps meta.version when the tests change, and not when they do not', async () => {
    const pkg = withGenerator(UNIQUE_PAIRS);
    const result = await generateHiddenTests(pkg, { crossCheck: false, workspaceRoot });

    const first = writeHiddenTests(pkg, result.hidden);
    expect(first.changed).toBe(true);
    expect(first.version).toBe(pkg.meta.version + 1);

    // Re-reading is what a second `problems:gen` run does; identical tests must
    // not move the version, or the version stops meaning "the tests changed".
    const reloaded = loadProblem(pkg.location).pkg!;
    const second = writeHiddenTests(reloaded, result.hidden);
    expect(second.changed).toBe(false);
    expect(second.version).toBeUndefined();
    expect(loadProblem(pkg.location).pkg?.meta.version).toBe(first.version);
  });

  it('changes nothing in meta.json but the version number', async () => {
    const pkg = withGenerator(UNIQUE_PAIRS);
    const metaPath = path.join(pkg.location.dir, 'meta.json');
    // Hand formatting of the kind a re-serialise destroys: an inline array and
    // an escape the author chose to write.
    const authored = fs
      .readFileSync(metaPath, 'utf8')
      .replace(/"version":\s*\d+/, '"version": 1')
      .replace(/\n\}\s*$/, ',\n  "note": "O(n \\u00b7 m)", "tags": ["a", "b"]\n}\n');
    fs.writeFileSync(metaPath, authored, 'utf8');
    const result = await generateHiddenTests(pkg, { crossCheck: false, workspaceRoot });

    writeHiddenTests(pkg, result.hidden);

    expect(fs.readFileSync(metaPath, 'utf8')).toBe(authored.replace('"version": 1', '"version": 2'));
  });
});
