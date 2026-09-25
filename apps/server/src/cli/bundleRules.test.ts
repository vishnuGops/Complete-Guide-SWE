import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  bundleRefusals,
  shipsBuildFile,
  shipsDependencyFile,
  shipsProblemFile,
} from './bundleRules.js';

/** The bundle's rules (ROADMAP P10-4); the bundle itself is built by `npm run package:win`. */

describe('problem files', () => {
  it('ships what the loader reads, and a statement’s images', () => {
    for (const name of [
      'meta.json',
      'statement.md',
      'tests.json',
      'reference.java',
      'checker.ts',
    ]) {
      expect(shipsProblemFile(path.join('problems', 'heap', 'x', name))).toBe(true);
    }
    expect(shipsProblemFile(path.join('problems', 'graph', 'x', 'assets', 'figure.svg'))).toBe(
      true,
    );
  });

  it('leaves the authoring tools behind', () => {
    expect(shipsProblemFile(path.join('problems', 'heap', 'x', 'generator.py'))).toBe(false);
    expect(
      shipsProblemFile(
        path.join('problems', 'heap', 'x', '__pycache__', 'reference.cpython-311.pyc'),
      ),
    ).toBe(false);
    expect(shipsProblemFile(path.join('problems', 'GENERATED_WITH'))).toBe(false);
  });
});

describe('build output', () => {
  it('ships code, not source maps, declarations or the packager itself', () => {
    expect(shipsBuildFile(path.join('dist', 'index.js'))).toBe(true);
    expect(shipsBuildFile(path.join('dist', 'cli', 'db.js'))).toBe(true);
    expect(shipsBuildFile(path.join('dist', 'index.js.map'))).toBe(false);
    expect(shipsBuildFile(path.join('dist', 'index.d.ts'))).toBe(false);
    expect(shipsBuildFile(path.join('dist', 'cli', 'package.js'))).toBe(false);
  });
});

describe('dependencies', () => {
  it('ship without their own test suites', () => {
    expect(shipsDependencyFile(path.join('zod', 'v4', 'index.js'))).toBe(true);
    expect(shipsDependencyFile(path.join('zod', 'src', 'v4', 'tests', 'string.test.ts'))).toBe(
      false,
    );
  });
});

describe('refusals', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'devpromax-bundle-'));
  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('passes a clean bundle', () => {
    fs.mkdirSync(path.join(root, 'apps', 'server', 'dist'), { recursive: true });
    fs.writeFileSync(path.join(root, 'apps', 'server', 'dist', 'index.js'), '');
    // Only the top-level data/ is practice data; a package may have its own.
    fs.mkdirSync(path.join(root, 'node_modules', 'some-lib', 'data'), { recursive: true });
    expect(bundleRefusals(root)).toEqual([]);
  });

  it('names each thing that must not ship, and why', () => {
    fs.mkdirSync(path.join(root, 'data'));
    fs.writeFileSync(path.join(root, 'node_modules', 'some-lib', 'binding.node'), '');
    fs.writeFileSync(path.join(root, '.env'), 'COACH_API_KEY=sk-no');
    fs.writeFileSync(path.join(root, 'apps', 'server', 'dist', 'index.test.js'), '');

    const refused = bundleRefusals(root);
    expect(refused).toContain('data (practice data)');
    expect(refused).toContain(
      `${path.join('node_modules', 'some-lib', 'binding.node')} (a native module)`,
    );
    expect(refused).toContain('.env (an environment file)');
    expect(refused).toContain(`${path.join('apps', 'server', 'dist', 'index.test.js')} (a test)`);
  });
});
