import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { workspaceAt } from '../workspace.js';
import { localLauncher, relativeTo } from './launcher.js';

/**
 * The local launcher names every file from the workspace, its working
 * directory (ROADMAP P10-1): an absolute path through a folder the ANSI code
 * page cannot spell reached `javac` as `??`. The run itself is in
 * `codepage.integration.test.ts`; this is the naming.
 */

const data = path.resolve('devpromax 测试', 'data');
const workspace = workspaceAt('abc', path.join(data, 'judge', 'abc'));

describe('localLauncher paths', () => {
  it('names workspace files and the workspace itself without mentioning where it is', () => {
    expect(localLauncher.path(workspace, 'Solution.java')).toBe('Solution.java');
    expect(localLauncher.dir(workspace)).toBe('.');
  });

  it('names the shared harness cache relative to the workspace', () => {
    const cache = path.join(data, 'devpromax-judge-cache', 'java-harness-0123');
    expect(localLauncher.shared(workspace, cache)).toBe(
      path.join('..', '..', 'devpromax-judge-cache', 'java-harness-0123'),
    );
  });
});

describe('relativeTo', () => {
  it('is "." for the workspace itself, never the empty string a class path would drop', () => {
    expect(relativeTo(workspace, workspace.dir)).toBe('.');
  });

  it.runIf(process.platform === 'win32')(
    'falls back to the absolute path across drives, where there is no relative one',
    () => {
      const onC = workspaceAt('abc', 'C:\\data\\judge\\abc');
      expect(relativeTo(onC, 'D:\\cache\\java-harness-0123')).toBe('D:\\cache\\java-harness-0123');
    },
  );
});
