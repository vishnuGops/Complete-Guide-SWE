import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createWorkspace, sweepStaleWorkspaces } from './workspace.js';

const roots: string[] = [];

function makeRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'devpromax-ws-'));
  roots.push(root);
  return root;
}

afterEach(() => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root) fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('createWorkspace', () => {
  it('creates an isolated directory named by a uuid', async () => {
    const root = makeRoot();
    const workspace = await createWorkspace(root);

    expect(fs.existsSync(workspace.dir)).toBe(true);
    expect(path.dirname(workspace.dir)).toBe(root);
    expect(workspace.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('gives two runs separate directories', async () => {
    const root = makeRoot();
    const a = await createWorkspace(root);
    const b = await createWorkspace(root);
    expect(a.dir).not.toBe(b.dir);
  });

  it('round-trips a file', async () => {
    const workspace = await createWorkspace(makeRoot());
    const written = await workspace.write('solution.py', 'print("hi")\n');
    expect(fs.readFileSync(written, 'utf8')).toBe('print("hi")\n');
    expect(await workspace.read('solution.py')).toBe('print("hi")\n');
  });

  it('reads a missing file as empty, since a dead harness never created it', async () => {
    const workspace = await createWorkspace(makeRoot());
    expect(await workspace.read('results.jsonl')).toBe('');
  });

  it('writes UTF-8 without mangling non-ASCII source', async () => {
    const workspace = await createWorkspace(makeRoot());
    const code = '# héllo → ☃\nprint("λ")\n';
    await workspace.write('solution.py', code);
    expect(await workspace.read('solution.py')).toBe(code);
  });

  it('removes the whole directory on dispose', async () => {
    const workspace = await createWorkspace(makeRoot());
    await workspace.write('nested/deep/file.txt', 'x');
    await workspace.dispose();
    expect(fs.existsSync(workspace.dir)).toBe(false);
  });

  it('is safe to dispose twice', async () => {
    const workspace = await createWorkspace(makeRoot());
    await workspace.dispose();
    await expect(workspace.dispose()).resolves.toBeUndefined();
  });
});

describe('sweepStaleWorkspaces', () => {
  it('removes directories older than the cutoff', async () => {
    const root = makeRoot();
    const stale = await createWorkspace(root);
    const old = Date.now() - 2 * 60 * 60 * 1000;
    fs.utimesSync(stale.dir, old / 1000, old / 1000);

    expect(await sweepStaleWorkspaces(root, 60 * 60 * 1000)).toBe(1);
    expect(fs.existsSync(stale.dir)).toBe(false);
  });

  it('leaves a fresh workspace alone, so it cannot race a run in progress', async () => {
    const root = makeRoot();
    const fresh = await createWorkspace(root);
    expect(await sweepStaleWorkspaces(root, 60 * 60 * 1000)).toBe(0);
    expect(fs.existsSync(fresh.dir)).toBe(true);
  });

  it('reports nothing when the root does not exist yet', async () => {
    expect(await sweepStaleWorkspaces(path.join(makeRoot(), 'never-created'))).toBe(0);
  });
});
