import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createCatalogue } from './catalogue.js';
import {
  makeCatalogue,
  writeProblem,
  json,
  VALID_META,
} from '../../problems/__fixtures__/factory.js';

/**
 * What the catalogue reads, and how often (ROADMAP P2-14).
 *
 * The measurements that produced this: twenty problems are seven megabytes of
 * `tests.json`, and reading them all on every `GET /api/problems` cost 120ms -
 * a second at two hundred. So the list reads `meta.json` only, nothing the API
 * serves reads the hidden tests, and reads are cached against modification
 * times rather than against `NODE_ENV`.
 */

const roots: string[] = [];

function catalogueRoot(): string {
  const root = makeCatalogue();
  roots.push(root);
  return root;
}

afterEach(() => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root) fs.rmSync(root, { recursive: true, force: true });
  }
});

/** Rewrites one file and moves its mtime forward, as an editor would. */
function edit(root: string, slug: string, file: string, contents: string): void {
  const full = path.join(root, 'arrays', slug, file);
  fs.writeFileSync(full, contents, 'utf8');
  const later = new Date(Date.now() + 2000);
  fs.utimesSync(full, later, later);
}

describe('the catalogue', () => {
  it('lists metadata without reading the rest of a problem', () => {
    const root = catalogueRoot();
    writeProblem(root, {});
    const catalogue = createCatalogue({ root });

    const entries = catalogue.listMeta();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.meta.title).toBe('Pair Sum Index');
  });

  it('still lists a problem whose statement is unreadable, because the list needs only meta', () => {
    // The list page is metadata; a half-written editorial should not empty it.
    const root = catalogueRoot();
    writeProblem(root, { files: { 'editorial.md': null } });
    const catalogue = createCatalogue({ root });

    expect(catalogue.listMeta()).toHaveLength(1);
    // The whole package is a different question, and that one is honestly
    // unreadable.
    expect(catalogue.get('pair-sum-index')).toBeUndefined();
  });

  it('serves a problem with its samples and the count of hidden tests, not the hidden tests', () => {
    const root = catalogueRoot();
    writeProblem(root, {});
    const catalogue = createCatalogue({ root });

    const pkg = catalogue.get('pair-sum-index');
    expect(pkg?.tests.samples.length).toBeGreaterThan(0);
    // The judge asks for these by name (`loadTests`); the catalogue does not
    // hold two hundred problems' worth of them in memory.
    expect(pkg?.tests.hidden).toEqual([]);
    expect(pkg?.hiddenCount).toBe(10);
  });

  it('sees an edit, because the cache is keyed on modification time', () => {
    const root = catalogueRoot();
    writeProblem(root, {});
    const catalogue = createCatalogue({ root });

    expect(catalogue.get('pair-sum-index')?.statement).toContain('list of integers and a target');

    edit(
      root,
      'pair-sum-index',
      'statement.md',
      '# Rewritten\n\n## Input\n\n## Output\n\n## Constraints\n\n## Examples\n',
    );

    expect(catalogue.get('pair-sum-index')?.statement).toContain('Rewritten');
  });

  it('sees a metadata edit through listMeta as well', () => {
    const root = catalogueRoot();
    writeProblem(root, {});
    const catalogue = createCatalogue({ root });
    expect(catalogue.listMeta()[0]?.meta.title).toBe('Pair Sum Index');

    edit(root, 'pair-sum-index', 'meta.json', json({ ...VALID_META, title: 'Renamed Problem' }));

    expect(catalogue.listMeta()[0]?.meta.title).toBe('Renamed Problem');
  });

  it('does not re-read a problem that has not changed', () => {
    const root = catalogueRoot();
    writeProblem(root, {});
    const catalogue = createCatalogue({ root });

    const first = catalogue.get('pair-sum-index');
    const second = catalogue.get('pair-sum-index');
    // The same object, not an equal one: proof that the second call parsed
    // nothing. Identity is the only honest test of a cache.
    expect(second).toBe(first);
  });

  it('notices a file being deleted, not only edited', () => {
    const root = catalogueRoot();
    writeProblem(root, {});
    const catalogue = createCatalogue({ root });
    expect(catalogue.get('pair-sum-index')).toBeDefined();

    fs.rmSync(path.join(root, 'arrays', 'pair-sum-index', 'hints.json'));

    // The stamp counts the files that exist, so a deletion is a change even
    // when nothing else was touched.
    expect(catalogue.get('pair-sum-index')).toBeUndefined();
  });

  it('forgets everything on reload', () => {
    const root = catalogueRoot();
    writeProblem(root, {});
    const catalogue = createCatalogue({ root });

    const first = catalogue.get('pair-sum-index');
    catalogue.reload();
    expect(catalogue.get('pair-sum-index')).not.toBe(first);
  });
});
