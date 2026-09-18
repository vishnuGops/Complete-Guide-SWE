import fs from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeCatalogue } from './__fixtures__/factory.js';
import { loadProblem } from './loader.js';
import { discoverProblems } from './loader.js';
import {
  camelFromSlug,
  pascalFromSlug,
  scaffoldFiles,
  titleFromSlug,
  writeScaffold,
} from './scaffold.js';
import { validateProblemPackage } from './validate.js';

/**
 * Scaffolding (ROADMAP P2-9).
 *
 * The contract is narrow and worth pinning: what `problems:new` writes must
 * *parse* - otherwise the validator cannot tell an author what is missing, it
 * can only say "unreadable" - and it must *not* pass, because a scaffold that
 * validated would be one nobody remembers to finish.
 */

let root: string;

beforeEach(() => {
  root = makeCatalogue();
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

function scaffoldAndLoad(options: Parameters<typeof writeScaffold>[0]) {
  writeScaffold(options, root);
  const location = discoverProblems(root).find((l) => l.slugDir === options.slug);
  expect(location, 'the scaffold was not discoverable').toBeDefined();
  return loadProblem(location!);
}

describe('naming', () => {
  it('derives a title, a method name and a class name from the slug', () => {
    expect(titleFromSlug('pair-sum-index')).toBe('Pair Sum Index');
    expect(camelFromSlug('pair-sum-index')).toBe('pairSumIndex');
    expect(pascalFromSlug('min-value-stack')).toBe('MinValueStack');
  });
});

describe('a function-mode scaffold', () => {
  const options = { topic: 'arrays', slug: 'shift-the-window', mode: 'function' } as const;

  it('parses, so the validator can say what is missing', () => {
    const { pkg, issues } = scaffoldAndLoad(options);
    expect(issues).toEqual([]);
    expect(pkg).toBeDefined();
  });

  it('does not pass validation: it is a scaffold, not a problem', () => {
    const { pkg } = scaffoldAndLoad(options);
    const problems = validateProblemPackage(pkg!);

    expect(problems.some((i) => i.message.includes('TODO'))).toBe(true);
    expect(problems.some((i) => i.message.includes('hidden tests'))).toBe(true);
  });

  it('names the entry method consistently across meta and both languages', () => {
    const { pkg } = scaffoldAndLoad(options);

    expect(pkg?.meta.entry).toBe('shiftTheWindow');
    expect(pkg?.sources.starterPython).toContain('def shiftTheWindow');
    expect(pkg?.sources.starterJava).toContain('shiftTheWindow');
    expect(pkg?.sources.referenceJava).toContain('shiftTheWindow');
  });

  it('writes a statement whose example headings match the sample count', () => {
    const { pkg } = scaffoldAndLoad(options);
    const examples = pkg?.statement.match(/^###\s+Example\b/gim)?.length ?? 0;

    // The 1:1 rule is checked by the validator; a scaffold that broke it would
    // hand every author a spurious error on day one.
    expect(examples).toBe(pkg?.tests.samples.length);
  });

  it('never emits a public Java class, which would collide with the harness', () => {
    const { pkg } = scaffoldAndLoad(options);
    expect(pkg?.sources.starterJava).not.toMatch(/public\s+class/);
    expect(pkg?.sources.starterJava).not.toMatch(/\bclass\s+Main\b/);
  });
});

describe('an operations-mode scaffold', () => {
  const options = { topic: 'stack', slug: 'bounded-queue', mode: 'operations' } as const;

  it('declares the class the harness will construct, in both languages', () => {
    const { pkg } = scaffoldAndLoad(options);

    expect(pkg?.meta.entry).toBe('BoundedQueue');
    expect(pkg?.sources.starterPython).toContain('class BoundedQueue:');
    expect(pkg?.sources.starterJava).toContain('class BoundedQueue {');
  });

  it('forces expect back to "return", which is all operations mode allows', () => {
    const { pkg } = scaffoldAndLoad({ ...options, expect: 'mutatedArgs' });
    expect(pkg?.meta.expect).toBe('return');
  });

  it('gives every sample a non-empty ops list', () => {
    const { pkg } = scaffoldAndLoad(options);
    for (const sample of pkg?.tests.samples ?? []) {
      expect(sample.ops?.length).toBeGreaterThan(0);
    }
  });
});

describe('a mutatedArgs scaffold', () => {
  it('asks for expectedMutatedArgs rather than a return value', () => {
    const { pkg } = scaffoldAndLoad({
      topic: 'arrays',
      slug: 'rotate-in-place',
      mode: 'function',
      expect: 'mutatedArgs',
    });

    for (const sample of pkg?.tests.samples ?? []) {
      expect(sample.expectedMutatedArgs).toBeDefined();
      expect(sample.expected).toBeUndefined();
    }
  });

  it('writes a signature that returns nothing (P6-0)', () => {
    // The scaffold used to emit `-> int` and `return 0` whatever the expect
    // mode was, so the first thing an author of an in-place problem had to do
    // was correct the signature the tool had just written - and in Java a
    // non-void method invites returning the answer instead of mutating.
    const { pkg } = scaffoldAndLoad({
      topic: 'arrays',
      slug: 'rotate-in-place',
      mode: 'function',
      expect: 'mutatedArgs',
    });

    expect(pkg?.sources.starterPython).toContain('-> None:');
    expect(pkg?.sources.starterPython).not.toContain('-> int:');
    expect(pkg?.sources.starterJava).toMatch(/public void \w+\(int\[\] nums\)/);
    expect(pkg?.sources.starterJava).not.toContain('return 0;');
  });
});

describe('writing', () => {
  it('puts the rating in the tier’s band', () => {
    const { pkg } = scaffoldAndLoad({
      topic: 'graph',
      slug: 'islands-count',
      mode: 'function',
      tier: 'Hard',
    });
    expect(pkg?.meta.rating).toBeGreaterThanOrEqual(8);
    expect(pkg?.meta.tier).toBe('Hard');
  });

  it('refuses to overwrite a problem that already exists', () => {
    const options = { topic: 'arrays', slug: 'already-here', mode: 'function' } as const;
    writeScaffold(options, root);
    expect(() => writeScaffold(options, root)).toThrow(/already exists/);
  });

  it('writes every required file', () => {
    const names = scaffoldFiles({ topic: 'arrays', slug: 'a-problem', mode: 'function' }).map(
      (file) => file.name,
    );
    expect(names).toEqual(
      expect.arrayContaining([
        'meta.json',
        'statement.md',
        'tests.json',
        'hints.json',
        'editorial.md',
        'starter.py',
        'reference.py',
        'starter.java',
        'reference.java',
        'generator.py',
      ]),
    );
  });
});
