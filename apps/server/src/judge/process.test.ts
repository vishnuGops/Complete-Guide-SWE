import { describe, expect, it } from 'vitest';
import { killLiveChildren, runProcess } from './process.js';

const NODE = process.execPath;

function node(script: string, timeoutMs = 10_000) {
  return runProcess({
    command: NODE,
    args: ['-e', script],
    cwd: process.cwd(),
    timeoutMs,
  });
}

describe('runProcess', () => {
  it('captures stdout and the exit code', async () => {
    const result = await node('process.stdout.write("hello"); process.exit(0)');
    expect(result.code).toBe(0);
    expect(result.stdout).toBe('hello');
    expect(result.killed).toBe(false);
  });

  it('captures stderr separately and reports a non-zero exit', async () => {
    const result = await node('process.stderr.write("bad"); process.exit(7)');
    expect(result.code).toBe(7);
    expect(result.stderr).toBe('bad');
    expect(result.stdout).toBe('');
  });

  it('waits for the pipes to drain, so output written just before exit is kept', async () => {
    // Large enough that the write cannot complete synchronously, but inside the
    // default 64 KB cap, so nothing is lost to truncation either.
    const result = await node('process.stdout.write("x".repeat(50000)); process.exit(0)');
    expect(result.stdout.length).toBe(50000);
  });

  it('kills a process that overruns its budget', async () => {
    const result = await node('setInterval(() => {}, 1000)', 500);
    expect(result.killed).toBe(true);
    expect(result.elapsedMs).toBeLessThan(5000);
  });

  it('kills the whole tree, not just the parent', async () => {
    // The child outlives its parent unless the tree is killed; if it survived it
    // would hold the workspace open, which on Windows makes it undeletable.
    const script = `
      const { spawn } = require('node:child_process');
      const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
      process.stdout.write(String(child.pid));
      setInterval(() => {}, 1000);
    `;
    const result = await runProcess({
      command: NODE,
      args: ['-e', script],
      cwd: process.cwd(),
      timeoutMs: 1000,
    });

    expect(result.killed).toBe(true);
    const grandchild = Number(result.stdout.trim());
    expect(Number.isFinite(grandchild)).toBe(true);

    // Give the OS a moment to reap, then confirm the grandchild is gone.
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(isAlive(grandchild)).toBe(false);
  });

  it('caps output rather than buffering without limit', async () => {
    const result = await runProcess({
      command: NODE,
      args: ['-e', 'process.stdout.write("x".repeat(50000))'],
      cwd: process.cwd(),
      timeoutMs: 10_000,
      outputCap: 1024,
    });

    expect(result.stdout.length).toBe(1024);
    expect(result.outputTruncated).toBe(true);
  });

  it('does not flag truncation when the output fits', async () => {
    const result = await runProcess({
      command: NODE,
      args: ['-e', 'process.stdout.write("short")'],
      cwd: process.cwd(),
      timeoutMs: 10_000,
      outputCap: 1024,
    });
    expect(result.outputTruncated).toBe(false);
  });

  it('closes stdin, so a process that reads it sees EOF immediately', async () => {
    const result = await node(
      'const fs = require("node:fs"); try { fs.readFileSync(0, "utf8"); process.stdout.write("eof"); } catch (e) { process.stdout.write("err"); }',
      5000,
    );
    expect(result.killed).toBe(false);
    expect(['eof', 'err']).toContain(result.stdout);
  });

  it('writes `input` to stdin and then closes it (P9-5)', async () => {
    const result = await runProcess({
      command: NODE,
      args: [
        '-e',
        'process.stdout.write(require("node:fs").readFileSync(0, "utf8").toUpperCase())',
      ],
      cwd: process.cwd(),
      timeoutMs: 10_000,
      input: 'déjà vu\n',
    });
    expect(result.code).toBe(0);
    expect(result.stdout).toBe('DÉJÀ VU\n');
  });

  it('survives a child that exits without reading its input', async () => {
    const result = await runProcess({
      command: NODE,
      args: ['-e', 'process.exit(3)'],
      cwd: process.cwd(),
      timeoutMs: 10_000,
      input: 'x'.repeat(1024 * 1024),
    });
    expect(result.code).toBe(3);
  });

  it('never goes through a shell, so metacharacters are literal arguments', async () => {
    const result = await runProcess({
      command: NODE,
      args: ['-e', 'process.stdout.write(process.argv[1] ?? "")', 'a && b > c'],
      cwd: process.cwd(),
      timeoutMs: 10_000,
    });
    expect(result.stdout).toBe('a && b > c');
  });

  it('rejects when the command does not exist', async () => {
    await expect(
      runProcess({
        command: 'devpromax-definitely-not-a-command',
        args: [],
        cwd: process.cwd(),
        timeoutMs: 5000,
      }),
    ).rejects.toThrow();
  });

  it('reports elapsed time', async () => {
    const result = await node('setTimeout(() => {}, 150)');
    expect(result.elapsedMs).toBeGreaterThan(100);
  });
});

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * The child's environment (ROADMAP P2-11).
 *
 * `runProcess` used to default to `process.env`, which is how the coach API key
 * reached the results panel. The default is the allow-list now, and this is the
 * cheap proof of it: the two executors' own version of this test spawns real
 * interpreters (`judge.integration.test.ts`).
 */
describe('runProcess environment', () => {
  it('does not pass the coach key to a child by default', async () => {
    process.env.COACH_API_KEY = 'sk-ant-unit-canary';
    process.env.DEVPROMAX_UNIT_CANARY = 'canary';
    try {
      const result = await node(
        'process.stdout.write(JSON.stringify([process.env.COACH_API_KEY ?? null, process.env.DEVPROMAX_UNIT_CANARY ?? null]))',
      );
      expect(JSON.parse(result.stdout)).toEqual([null, null]);
    } finally {
      delete process.env.COACH_API_KEY;
      delete process.env.DEVPROMAX_UNIT_CANARY;
    }
  });

  it('still passes PATH, or nothing would start', async () => {
    const result = await node(
      'process.stdout.write(String(Boolean(process.env.PATH ?? process.env.Path)))',
    );
    expect(result.stdout).toBe('true');
  });

  it('uses exactly the environment it is given, when it is given one', async () => {
    const result = await runProcess({
      command: NODE,
      args: ['-e', 'process.stdout.write(process.env.DEVPROMAX_ONLY ?? "missing")'],
      cwd: process.cwd(),
      timeoutMs: 10_000,
      env: { ...(process.env.PATH ? { PATH: process.env.PATH } : {}), DEVPROMAX_ONLY: 'yes' },
    });
    expect(result.stdout).toBe('yes');
  });
});

/**
 * The stall watchdog (ROADMAP P2-13).
 *
 * `progress` is a function here rather than a file, which is what makes the
 * bound testable: the judge passes the size of the results file, and the
 * integration suite proves the real thing ends as a timeout.
 */
describe('runProcess stall detection', () => {
  it('kills a child that stops making progress', async () => {
    const started = Date.now();
    const result = await runProcess({
      command: NODE,
      // Alive and silent, with a wall clock far beyond the stall budget.
      args: ['-e', 'setInterval(() => {}, 1000)'],
      cwd: process.cwd(),
      timeoutMs: 30_000,
      stall: { ms: 600, progress: () => 0 },
    });

    expect(result.killed).toBe(true);
    // Killed by the stall, not by the wall clock, which is fifty times longer.
    expect(Date.now() - started).toBeLessThan(10_000);
  });

  it('leaves a child alone while it is making progress', async () => {
    let ticks = 0;
    const result = await runProcess({
      command: NODE,
      args: ['-e', 'setTimeout(() => { process.stdout.write("done"); }, 1200)'],
      cwd: process.cwd(),
      timeoutMs: 30_000,
      // Progress changes on every poll, which is what a results file growing
      // once per completed test looks like.
      stall: {
        ms: 400,
        progress: () => {
          ticks += 1;
          return ticks;
        },
      },
    });

    expect(result.killed).toBe(false);
    expect(result.stdout).toBe('done');
    expect(ticks).toBeGreaterThan(1);
  });

  it('does not watch for a stall when no budget is given', async () => {
    const result = await runProcess({
      command: NODE,
      args: ['-e', 'setTimeout(() => { process.stdout.write("ok"); }, 700)'],
      cwd: process.cwd(),
      timeoutMs: 30_000,
    });

    expect(result.killed).toBe(false);
    expect(result.stdout).toBe('ok');
  });
});

describe('runProcess onKill (P9-2)', () => {
  /*
   * Killing the `docker` client does not stop the container it started, so the
   * Docker executor hangs the real kill on this hook. Every path that kills a
   * child has to call it, or that path leaves a container running.
   */
  it('is called when the wall clock kills the child', async () => {
    let calls = 0;
    const result = await runProcess({
      command: NODE,
      args: ['-e', 'setInterval(() => {}, 1000)'],
      cwd: process.cwd(),
      timeoutMs: 400,
      onKill: () => {
        calls += 1;
      },
    });
    expect(result.killed).toBe(true);
    expect(calls).toBe(1);
  });

  it('is called when the stall watchdog kills the child', async () => {
    let calls = 0;
    const result = await runProcess({
      command: NODE,
      args: ['-e', 'setInterval(() => {}, 1000)'],
      cwd: process.cwd(),
      timeoutMs: 30_000,
      stall: { ms: 400, progress: () => 0 },
      onKill: () => {
        calls += 1;
      },
    });
    expect(result.killed).toBe(true);
    expect(calls).toBe(1);
  });

  it('is called by killLiveChildren, which is what Ctrl+C runs', async () => {
    let calls = 0;
    const running = runProcess({
      command: NODE,
      args: ['-e', 'setInterval(() => {}, 1000)'],
      cwd: process.cwd(),
      timeoutMs: 30_000,
      onKill: () => {
        calls += 1;
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(killLiveChildren()).toBeGreaterThanOrEqual(1);
    await running;
    expect(calls).toBe(1);
  });

  it('is not called for a child that exits by itself', async () => {
    let calls = 0;
    await runProcess({
      command: NODE,
      args: ['-e', 'process.exit(0)'],
      cwd: process.cwd(),
      timeoutMs: 10_000,
      onKill: () => {
        calls += 1;
      },
    });
    expect(calls).toBe(0);
  });
});
