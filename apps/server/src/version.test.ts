import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { repoRoot } from './config.js';
import { APP_VERSION, readVersion } from './version.js';

/**
 * One version for the whole app (ROADMAP P10-2): the root `package.json`, with
 * the workspaces following it, read once by the server and later by the
 * installer and the release workflow.
 */

describe('the version', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'devpromax-version-'));

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('is the root manifest’s', () => {
    const root = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as {
      version: string;
    };
    expect(APP_VERSION).toBe(root.version);
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });

  it.each(['apps/server', 'apps/web', 'packages/shared'])('is followed by %s', (workspace) => {
    // Three numbers that can drift apart are three answers to "which version
    // is this"; the installer reads one of them and a bug report quotes another.
    const manifest = JSON.parse(
      fs.readFileSync(path.join(repoRoot, workspace, 'package.json'), 'utf8'),
    ) as { version: string };
    expect(manifest.version).toBe(APP_VERSION);
  });

  it('refuses a manifest without one, rather than reporting "undefined" to a launcher', () => {
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'x' }));
    expect(() => readVersion(dir)).toThrow(/has no version/);

    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ version: '2.3.4' }));
    expect(readVersion(dir)).toBe('2.3.4');
  });
});
