import { spawn, type ChildProcess } from 'node:child_process';
import { OUTPUT_CAP_BYTES } from '@devpromax/shared';
import { childEnv } from './childEnv.js';

export interface SpawnOptions {
  command: string;
  args: string[];
  cwd: string;
  timeoutMs: number;
  /** Combined stdout+stderr kept before truncation. */
  outputCap?: number;
  /**
   * The child's whole environment. Defaults to the allow-list in
   * `childEnv.ts` - never `process.env`, which carries the coach API key
   * (ROADMAP P2-11).
   */
  env?: NodeJS.ProcessEnv;
}

export interface SpawnResult {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  /** True when the watchdog killed the process rather than it exiting. */
  killed: boolean;
  outputTruncated: boolean;
  elapsedMs: number;
}

/**
 * Every judge child currently running (ROADMAP P3-6).
 *
 * Needed for one thing: Ctrl+C. Node kills the process, not its grandchildren,
 * so a `java` holding a workspace open survived the server that started it -
 * and on Windows kept the directory undeletable until someone found it in the
 * task list. The set is small by construction (the queue is two wide by
 * default) and entries remove themselves when the child exits.
 */
const live = new Set<ChildProcess>();

/** Kills every judge child and everything they started. */
export function killLiveChildren(): number {
  const count = live.size;
  for (const child of live) killTree(child);
  live.clear();
  return count;
}

/**
 * Kills a process and everything it started.
 *
 * A solution that spawns children - deliberately or through a library - would
 * otherwise leave orphans holding the workspace open, which on Windows makes the
 * directory undeletable. `taskkill /T /F` walks the tree; on POSIX the child is
 * its own process-group leader (`detached`) so a negative PID signals the group.
 */
export function killTree(child: ChildProcess): void {
  const pid = child.pid;
  if (pid === undefined) return;

  if (process.platform === 'win32') {
    // Detached and unref'd: reaping the tree must not keep the judge alive, and
    // a failure here (the process already exited) is not interesting.
    //
    // The `error` handler is not optional (P2-11): `spawn` reports a failure to
    // start - taskkill missing from a trimmed PATH, or the process table full -
    // as an `error` *event*, not a throw. Unhandled, that event is an
    // uncaught exception on an EventEmitter, which takes the server down and
    // with it the queue slot this kill was supposed to free.
    try {
      const killer = spawn('taskkill', ['/pid', String(pid), '/T', '/F'], {
        stdio: 'ignore',
        detached: true,
      });
      killer.on('error', () => {
        forceKill(child);
      });
      killer.unref();
    } catch {
      forceKill(child);
    }
    return;
  }

  try {
    process.kill(-pid, 'SIGKILL');
  } catch {
    forceKill(child);
  }
}

/** Last resort: the child alone, and never a throw - it may already be gone. */
function forceKill(child: ChildProcess): void {
  try {
    child.kill('SIGKILL');
  } catch {
    // Already gone, which is the outcome this function wanted anyway.
  }
}

/**
 * Runs a command to completion with a wall-clock limit and a byte cap on its
 * output.
 *
 * stdin is closed, so a solution that reads input fails immediately with EOF
 * instead of hanging until the timeout and reporting a confusing TLE. The shell
 * is never involved: arguments go to the process verbatim, which is both safer
 * and the only way paths with spaces behave the same on both platforms.
 */
export function runProcess(options: SpawnOptions): Promise<SpawnResult> {
  const cap = options.outputCap ?? OUTPUT_CAP_BYTES;
  const started = process.hrtime.bigint();

  return new Promise<SpawnResult>((resolve, reject) => {
    const child = spawn(options.command, options.args, {
      cwd: options.cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      detached: process.platform !== 'win32',
      env: options.env ?? childEnv(),
      windowsHide: true,
    });

    live.add(child);

    let stdout = '';
    let stderr = '';
    let outputTruncated = false;
    let killed = false;
    let settled = false;

    const append = (current: string, chunk: string): string => {
      if (current.length >= cap) {
        outputTruncated = true;
        return current;
      }
      const room = cap - current.length;
      if (chunk.length > room) {
        outputTruncated = true;
        return current + chunk.slice(0, room);
      }
      return current + chunk;
    };

    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => {
      stdout = append(stdout, chunk);
    });
    child.stderr?.on('data', (chunk: string) => {
      stderr = append(stderr, chunk);
    });

    const watchdog = setTimeout(() => {
      killed = true;
      killTree(child);
    }, options.timeoutMs);

    const finish = (code: number | null, signal: NodeJS.Signals | null): void => {
      if (settled) return;
      settled = true;
      live.delete(child);
      clearTimeout(watchdog);
      resolve({
        code,
        signal,
        stdout,
        stderr,
        killed,
        outputTruncated,
        elapsedMs: Number(process.hrtime.bigint() - started) / 1e6,
      });
    };

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      live.delete(child);
      clearTimeout(watchdog);
      reject(err);
    });

    // 'close' rather than 'exit': it fires once the pipes have drained, so no
    // output written just before exit is lost.
    child.on('close', finish);
  });
}

/** True when the command exists and can be started at all. */
export async function commandAvailable(
  command: string,
  args: string[] = ['--version'],
): Promise<boolean> {
  try {
    const result = await runProcess({
      command,
      args,
      cwd: process.cwd(),
      timeoutMs: 10_000,
      outputCap: 4096,
    });
    return result.code === 0;
  } catch {
    return false;
  }
}
